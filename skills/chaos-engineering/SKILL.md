---
name: chaos-engineering
description: Guides systematic fault injection and resilience testing. Use when designing for high availability, verifying disaster recovery, testing failure modes, or building fault-tolerant systems. Use when you need to prove your system survives infrastructure failures, network partitions, dependency outages, or cascading errors.
---

# Chaos Engineering

## Overview

Chaos engineering is the discipline of experimenting on a system to build confidence in its capability to withstand turbulent conditions. Instead of hoping nothing breaks, you intentionally break things in controlled ways to discover weaknesses before they discover you in production.

**The core insight:** Systems fail in ways you didn't anticipate. You can't test for every failure mode, but you can systematically surface unknown dependencies, hidden single points of failure, and misconfigured timeouts. Chaos engineering turns "it probably works" into "we've proven it works under these failure conditions."

## When to Use

- Building or operating distributed systems (microservices, serverless, multi-region)
- Before a major launch or traffic event where failure is expensive
- After architectural changes that affect data flow or service dependencies
- When incident post-mortems reveal "we didn't know X could fail"
- Setting SLOs/SLAs and need empirical data on actual failure behavior
- Migrating to new infrastructure (cloud provider, database, message queue)

**NOT for:**
- Systems without basic monitoring and observability (you can't chaos test what you can't observe)
- Production environments without on-call coverage and rollback procedures
- Systems handling life-critical or financial transactions without explicit authorization

## The Chaos Engineering Process

### Step 1: Define Steady State

Before you break anything, define what "working" looks like:

```text
STEADY STATE HYPOTHESIS:
- Metric: [quantifiable metric, e.g. p99 latency < 200ms]
- Baseline: [current observed value, e.g. 145ms]
- Threshold: [failure threshold, e.g. > 300ms]
- Duration: [how long the system must maintain this, e.g. 5 minutes]
```text

**Good steady state metrics:**
- Request success rate (should be > 99.9% for most services)
- p50/p99 latency (measured from the client perspective)
- Error rate by endpoint (catch localized failures)
- Queue depth / backlog (for async systems)
- Business metrics (checkouts completed, messages processed)

**Bad steady state metrics:**
- "The service is up" (up != working)
- CPU utilization (a bad metric for user-facing health)
- "No alerts are firing" (your alerts might be wrong)

### Step 2: Design the Experiment

Every chaos experiment has five components:

```text
1. SCOPE: What are we testing?
   └── Single service? Whole region? Database cluster?

2. FAULT: What are we injecting?
   └── Network latency? Packet loss? Service crash? Disk fill?

3. BLAST RADIUS: What's the maximum damage?
   └── One pod? One AZ? Can we abort instantly?

4. ABORT CONDITIONS: When do we stop?
   └── Error rate > 1%? Latency > 500ms? Customer complaints?

5. ROLLBACK: How do we undo?
   └── Kill switch? Feature flag? Automatic after duration?
```text

**Blast radius progression (never skip steps):**

```text
Development environment → Single instance → Single AZ → Production canary → Full production
```text

### Step 3: Run the Experiment

Execute with a clear observer and an abort button:

```bash
# Example: Network latency injection with tc (Linux)
# Add 100ms latency to eth0 for 60 seconds
tc qdisc add dev eth0 root netem delay 100ms 20ms distribution normal
echo "Injecting latency... Press Ctrl+C to abort"
sleep 60
tc qdisc del dev eth0 root netem  # Cleanup
```text

**During the experiment:**
- One person watches dashboards (error rate, latency, business metrics)
- One person controls the experiment (injects fault, can abort)
- Document actual vs expected behavior in real-time
- If abort conditions trigger, stop immediately — don't "see what happens"

### Step 4: Measure and Analyze

Compare results to your steady state hypothesis:

```markdown
## Experiment Results: [Name]

### Hypothesis
During [fault], [metric] will remain within [threshold] because [reasoning].

### Actual Results
| Metric | Baseline | During Fault | Delta | Hypothesis |
|--------|----------|--------------|-------|------------|
| p99 latency | 145ms | 890ms | +745ms | ❌ FAILED |
| Error rate | 0.01% | 12.3% | +12.29% | ❌ FAILED |
| Checkout rate | 450/min | 48/min | -402/min | ❌ FAILED |

### What We Learned
- The caching layer timeout (30s) is too long — downstream failures cascade
- The fallback to stale cache data isn't being triggered (bug in fallback logic)
- Database connection pool (size 10) exhausted under retry storm

### Action Items
1. Reduce cache timeout to 2s with stale-while-revalidate
2. Fix fallback logic: should serve stale cache on cache miss + dependency down
3. Increase connection pool to 50 with circuit breaker
```text

### Step 5: Fix and Verify

Every failed experiment must result in fixes and a re-run:

```text
Fix identified weakness → Deploy fix → Re-run same experiment → Verify hypothesis passes
```text

A chaos experiment that fails and isn't re-run is worse than no experiment — it proves you know about a weakness and haven't fixed it.

## Fault Injection Patterns

### Infrastructure Failures

```bash
# CPU stress
stress-ng --cpu 8 --timeout 60s

# Memory exhaustion
stress-ng --vm 4 --vm-bytes 1G --timeout 60s

# Disk I/O saturation
fio --name=randwrite --ioengine=libaio --iodepth=32 --rw=randwrite \
    --bs=4k --direct=1 --size=4G --numjobs=4 --runtime=60

# Network partition (block specific host)
iptables -A OUTPUT -d 10.0.1.5 -j DROP
# ... experiment ...
iptables -D OUTPUT -d 10.0.1.5 -j DROP  # Cleanup
```text

### Application Failures

```bash
# Kill a random pod (Kubernetes)
kubectl delete pod -l app=api-gateway --grace-period=0 --force

# Simulate dependency timeout
# Configure HTTP client timeout to 1ms temporarily

# Database connection failure
# iptables block to database port
iptables -A OUTPUT -p tcp --dport 5432 -j DROP
```text

### Dependency Failures

```typescript
// Programmatic fault injection with a chaos proxy
import { ChaosProxy } from './chaos-proxy';

const proxy = new ChaosProxy({
  target: 'https://payments-api.internal',
  faults: [
    { type: 'latency', duration: '100ms', probability: 0.1 },
    { type: 'error', statusCode: 503, probability: 0.05 },
    { type: 'timeout', delay: '5s', probability: 0.02 },
  ],
});
```text

## Chaos Engineering Maturity Model

```text
Level 1 — Ad-hoc        → Run experiments manually, reactively after incidents
Level 2 — Planned       → Schedule experiments, define hypotheses, measure results
Level 3 — Automated     → CI pipeline runs experiments automatically, gates deploys
Level 4 — Continuous    → Production runs small experiments continuously (1% of traffic)
Level 5 — Game Days     → Regular cross-team disaster simulations with business stakeholders
```text

## Tools by Layer

| Layer | Tools | What They Test |
|-------|-------|----------------|
| Infrastructure | Chaos Monkey, Gremlin, AWS Fault Injection Simulator | EC2/VM failures, AZ outages, network partitions |
| Kubernetes | PowerfulSeal, Litmus, Chaos Mesh | Pod kills, network policies, resource limits |
| Application | Toxiproxy, Wiremock (fault mode), custom proxies | Dependency latency, timeouts, error responses |
| Database | Jepsen, pgbench with fault injection | Transaction consistency, replication lag, failover |
| Network | tc, Pumba, Blockade | Latency, packet loss, bandwidth limits, partitions |

## Safety Rules

1. **Never experiment in production without monitoring.** If you can't see the impact, you can't abort in time.
2. **Always have an abort button.** Every experiment must be stoppable in < 30 seconds.
3. **Start small, grow radius.** Development → Staging → Canary → Full production.
4. **Business hours only.** Run experiments when the team is online and can respond.
5. **Document and share.** Every experiment result belongs in the team's knowledge base.
6. **Fix what you find.** A failed experiment without a fix is a liability, not a learning.

## Game Day Structure

A game day is a scheduled, cross-team chaos event that simulates a major outage:

```text
Week Before:
├── Define scenario (e.g., "Primary database fails during peak traffic")
├── Identify observers from each team
├── Prepare runbook for the scenario
├── Schedule war room (video call + shared doc)
└── Notify stakeholders (don't surprise customer-facing teams)

Day Of:
├── 0:00 — Inject fault (controlled, with observer ready)
├── 0:01-0:05 — Detect: How long until monitoring shows the issue?
├── 0:05-0:15 — Triage: What's the blast radius? Which users are affected?
├── 0:15-0:30 — Respond: Execute runbook, apply mitigations
├── 0:30-0:45 — Recover: Verify steady state restored
├── 0:45-1:00 — Document: Record timeline, decisions, and gaps
└── 1:00+ — Retro: What worked, what didn't, what needs fixing
```text

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We can't test in production" | That's what staging is for. Run experiments there first. But eventually you must test production — staging is never identical. |
| "Our system is too simple for chaos engineering" | Simple systems have simple failure modes. A single dependency failure might be catastrophic. Test it. |
| "We'll just add retries and circuit breakers" | Retries without backoff create retry storms. Circuit breakers without tuning trip too early or too late. Chaos engineering validates these configurations empirically. |
| "This is too risky" | Running without resilience validation is riskier. You just don't know your risk exposure. |
| "We can test this with unit tests" | Unit tests validate code. Chaos engineering validates system behavior under real-world failure conditions. Both are necessary. |

## Red Flags

- Chaos experiments that never fail (you're not testing hard enough)
- Experiments run without defined abort conditions
- Failed experiments documented but never fixed
- Testing only in development (production behavior differs)
- No monitoring or dashboards during experiments
- Experiments run outside business hours without on-call coverage
- Blast radius increases faster than organizational maturity

## See Also

- For operational readiness checks, see `references/reliability-checklist.md`
- For security pre-launch checks, see `references/security-checklist.md`
- For performance review checks, see `references/performance-checklist.md`

## Verification

Before declaring a system chaos-ready:

- [ ] Steady state is defined and measurable
- [ ] At least one experiment has been run in staging
- [ ] Experiment results are documented with pass/fail criteria
- [ ] Failed experiments have associated fix tickets with owners
- [ ] Abort conditions are configured and tested
- [ ] Team knows how to read relevant dashboards under pressure
- [ ] Game day has been completed at least once
- [ ] Chaos experiments are in CI/CD or scheduled regularly
