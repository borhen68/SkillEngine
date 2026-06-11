# Agent Skills — Production-grade Makefile
# Usage: make <target>

.PHONY: help install test validate lint quality ci clean stats packages

# Default target
.DEFAULT_GOAL := help

# Colors
BLUE  := \033[36m
GREEN := \033[32m
RED   := \033[31m
YELLOW:= \033[33m
RESET := \033[0m

help: ## Show this help message
	@echo ""
	@echo "$(BLUE)Agent Skills — Development Commands$(RESET)"
	@echo "========================================"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-20s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""

install: ## Install Node.js dependencies
	@echo "$(BLUE)Installing dependencies...$(RESET)"
	npm install

test: ## Run full test suite (validate + lint + hooks + quality)
	@echo "$(BLUE)Running full test suite...$(RESET)"
	npm run test

validate: ## Validate all skill files
	@echo "$(BLUE)Validating skills...$(RESET)"
	node scripts/validate-skills.js

validate-strict: ## Validate skills with strict mode (warnings = errors)
	@echo "$(BLUE)Validating skills (strict mode)...$(RESET)"
	node scripts/validate-skills.js --strict

lint: ## Lint all markdown files
	@echo "$(BLUE)Linting markdown...$(RESET)"
	npm run lint:md

lint-fix: ## Auto-fix markdown linting issues
	@echo "$(BLUE)Auto-fixing markdown...$(RESET)"
	npm run lint:md:fix

lint-scripts: ## Lint shell scripts with shellcheck
	@echo "$(BLUE)Linting shell scripts...$(RESET)"
	-shellcheck hooks/*.sh

hooks: ## Test all hooks
	@echo "$(BLUE)Testing hooks...$(RESET)"
	bash hooks/session-start-test.sh
	bash hooks/simplify-ignore-test.sh

quality: ## Run cross-skill quality gates
	@echo "$(BLUE)Running quality gates...$(RESET)"
	node scripts/quality-gate.js

quality-report: ## Generate quality report JSON
	@echo "$(BLUE)Generating quality report...$(RESET)"
	node scripts/quality-gate.js --report

agents: ## Validate agent personas
	@echo "$(BLUE)Validating agents...$(RESET)"
	node scripts/validate-agents.js

stats: ## Show project statistics
	@echo "$(BLUE)Project statistics...$(RESET)"
	node scripts/project-stats.js

packages: ## Build all skill zip packages
	@echo "$(BLUE)Building packages...$(RESET)"
	node scripts/build-packages.js

ci: ## Run the full CI pipeline locally
	@echo "$(BLUE)Running CI pipeline...$(RESET)"
	npm run ci

clean: ## Clean generated artifacts
	@echo "$(BLUE)Cleaning artifacts...$(RESET)"
	rm -f quality-report.json
	rm -rf node_modules package-lock.json
	find skills -name "*.zip" -delete

dev-setup: ## Full local development setup
	@echo "$(BLUE)Setting up development environment...$(RESET)"
	npm install
	node scripts/validate-skills.js
	node scripts/quality-gate.js
	@echo "$(GREEN)Setup complete! Run 'make test' to verify.$(RESET)"
