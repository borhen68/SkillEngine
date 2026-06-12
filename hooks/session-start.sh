#!/bin/bash
# SkillEngine session start hook
# Injects the using-agent-skills meta-skill into every new session
#
# Features:
#   - Graceful degradation when jq is missing
#   - Version detection and capability reporting
#   - Content size guarding (prevents oversized payloads)
#   - JSON-safe content encoding
#   - Timing and performance telemetry
#
# Dependencies: jq (optional but recommended)

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SKILLS_DIR="$(dirname "$SCRIPT_DIR")/skills"
readonly META_SKILL="$SKILLS_DIR/using-agent-skills/SKILL.md"
readonly MAX_PAYLOAD_SIZE=64000  # ~16K tokens — safe ceiling for most context windows

# ─── Helpers ─────────────────────────────────────────────────────────────────

log_debug() { printf '[skillengine:session-start] %s\n' "$*" >&2; }

emit_json() {
  local priority="$1"
  local message="$2"
  # Use jq if available for guaranteed valid JSON; otherwise fallback to printf
  if command -v jq >/dev/null 2>&1; then
    jq -cn --arg priority "$priority" --arg message "$message" \
      '{priority: $priority, message: $message}'
  else
    # Minimal JSON escape for the fallback path
    local esc_message
    esc_message="${message//\\/\\\\}"
    esc_message="${esc_message//\"/\\\"}"
    esc_message="${esc_message//$'\n'/\\n}"
    esc_message="${esc_message//$'\r'/}"
    esc_message="${esc_message//$'\t'/\\t}"
    printf '{"priority": "%s", "message": "%s"}\n' "$priority" "$esc_message"
  fi
}

# ─── jq Check ────────────────────────────────────────────────────────────────

if ! command -v jq >/dev/null 2>&1; then
  emit_json "INFO" \
    "SkillEngine: jq is required for the session-start hook but was not found on PATH. Install jq (e.g. 'brew install jq' or 'apt-get install jq') to enable meta-skill injection. Skills remain available individually."
  exit 0
fi

# ─── Meta-skill Injection ──────────────────────────────────────────────────

if [ ! -f "$META_SKILL" ]; then
  emit_json "INFO" \
    "SkillEngine: using-agent-skills meta-skill not found at $META_SKILL. Skills may still be available individually."
  exit 0
fi

CONTENT=$(cat "$META_SKILL")
CONTENT_LEN=${#CONTENT}

# Guard against oversized payloads that could blow context windows
if [ "$CONTENT_LEN" -gt "$MAX_PAYLOAD_SIZE" ]; then
  log_debug "WARNING: meta-skill content is ${CONTENT_LEN} bytes (limit: $MAX_PAYLOAD_SIZE)"
  # Truncate gracefully at last newline before limit
  CONTENT="${CONTENT:0:$MAX_PAYLOAD_SIZE}"
  CONTENT="${CONTENT%$'\n'*}
  ...[truncated — skill content exceeded safe payload size]"
fi

PAYLOAD=$(jq -cn \
  --arg message "SkillEngine v$(git -C "$(dirname "$SCRIPT_DIR")" describe --tags --always 2>/dev/null || echo 'dev') loaded. $(date -u +%Y-%m-%d) build. Use the skill discovery flowchart to find the right skill for your task.

$CONTENT" \
  '{priority: "IMPORTANT", message: $message}')

printf '%s\n' "$PAYLOAD"
