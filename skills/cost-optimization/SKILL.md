---
name: cost-optimization
description: Guides systematic cloud and infrastructure cost reduction. Use when cloud bills are growing unpredictably, when rightsizing resources, when evaluating reserved capacity, or when building cost-aware architecture. Use when you need to optimize spend without sacrificing reliability or performance.
---

# Cost Optimization

## Overview

Cost optimization is not about being cheap — it's about spending money where it creates value and eliminating waste. In cloud environments, costs compound silently: oversized instances, forgotten dev
environments, unoptimized storage tiers, and data transfer charges that nobody tracks. This skill provides a systematic approach to finding and eliminating waste while maintaining (or improving)
system reliability.

**The 80/20 rule of cloud costs:** 80% of your bill comes from 20% of your resources. Focus on the big items first.

## When to Use

- Monthly cloud bill has grown > 20% without corresponding traffic growth
- Setting up new infrastructure and want cost-aware defaults
- Reviewing architecture for a system that's been running > 6 months
- Preparing for scaling events (launch, Black Friday, viral growth)
- Evaluating multi-cloud vs single-cloud strategies
- After an audit reveals "surprise" charges (data transfer, API calls, storage)

**NOT for:**

- Systems where reliability is worth any cost (life-critical, financial trading)
- One-time cost reduction without ongoing monitoring (costs creep back)

## The Cost Optimization Process

### Step 1: Measure and Allocate

You can't optimize what you can't measure. Before changing anything:

```text
COST ALLOCATION FRAMEWORK:
├── Tag everything (owner, environment, product, cost-center)
├── Enable detailed billing exports (hourly granularity)
├── Set up cost anomaly detection
├── Allocate shared costs (network, monitoring, platform)
└── Create per-team visibility dashboards
```

**Key metrics to track:**

| Metric | Why It Matters | Target |
|--------|---------------|--------|
| Cost per request | Efficiency of serving traffic | Trending down |
| Cost per user | Unit economics | Trending down |
| Idle resource % | Waste identification | < 10% |
| Storage $/GB | Tier optimization | Match workload pattern |
| Data transfer | Often the "surprise" line item | < 10% of total |

### Step 2: Identify Waste

Run through this checklist systematically:

**Compute Waste:**

- [ ] Instances with average CPU < 20% over 7 days
- [ ] Instances with memory utilization < 40%
- [ ] Running instances in dev/staging outside business hours
- [ ] Over-provisioned container requests (K8s)
- [ ] Unused auto-scaling groups with min-size > 0
- [ ] Legacy instance types (newer generations are cheaper per performance unit)

**Storage Waste:**

- [ ] Unattached volumes > 30 days old
- [ ] Snapshots without retention policies
- [ ] Objects in hot storage with no access in 90 days
- [ ] Database instances with storage utilization < 30%
- [ ] Logs stored indefinitely without lifecycle policies

**Network Waste:**

- [ ] Cross-AZ traffic that could be co-located
- [ ] Data transfer to internet instead of CDN
- [ ] NAT Gateway traffic that could use VPC endpoints
- [ ] Cross-region replication that's not needed
- [ ] Egress charges from services that could use private connectivity

**Licensing/Reserved Waste:**

- [ ] On-demand instances that could use reserved capacity
- [ ] Reserved capacity for services that are being decommissioned
- [ ] Database licenses where open-source alternatives suffice
- [ ] Unused SaaS subscriptions (monitoring, CI/CD, etc.)

### Step 3: Rightsize Resources

```text
RIGHTSIZING WORKFLOW:
1. Collect metrics (CPU, memory, disk I/O, network) for 14+ days
2. Identify peak vs average vs p99 usage patterns
3. Match instance/container size to actual needs + 20% headroom
4. Test the smaller size in staging under load
5. Deploy to production with monitoring
6. Observe for 48 hours, adjust if needed
```

**Rightsizing examples:**

```bash
# Before: c5.2xlarge (8 vCPU, 16 GB) — $0.34/hour
# Metrics show: 15% CPU avg, 45% memory avg, never bursts above 40%
# After: c5.large (2 vCPU, 4 GB) — $0.085/hour
# Savings: 75% for this instance

# Kubernetes: Adjust resource requests
# Before:
resources:
  requests:
    cpu: 2000m      # Never uses more than 500m
    memory: 8Gi     # Uses 2Gi consistently

# After:
resources:
  requests:
    cpu: 750m       # 50% overhead on observed peak
    memory: 3Gi     # 50% overhead on observed peak
  limits:
    cpu: 1500m
    memory: 6Gi
```

### Step 4: Optimize Storage Tiers

Match storage to access patterns:

```text
DATA ACCESS PATTERN → STORAGE TIER
─────────────────────────────────────────────────
Frequently accessed (< 7 days)    → Hot / Standard
Occasionally accessed (7-90 days) → Warm / Infrequent Access
Rarely accessed (90+ days)        → Cold / Archive
Never accessed (backup only)      → Glacier / Deep Archive
```

**Storage optimization examples:**

```bash
# S3 Lifecycle Policy
{
  "Rules": [
    {
      "ID": "MoveOldLogsToGlacier",
      "Status": "Enabled",
      "Filter": { "Prefix": "logs/" },
      "Transitions": [
        { "Days": 30, "StorageClass": "STANDARD_IA" },
        { "Days": 90, "StorageClass": "GLACIER" }
      ],
      "Expiration": { "Days": 2555 }  // 7 years retention
    }
  ]
}

# Database: Use read replicas for read-heavy workloads
# Instead of scaling primary DB vertically ($$$), add read replicas ($)
```

### Step 5: Reserved Capacity and Commitments

```text
RESERVED CAPACITY DECISION MATRIX:

Usage Pattern          → Recommendation
─────────────────────────────────────────────────
24/7 steady state      → 1-year reserved (40-60% savings)
Predictable growth     → 3-year reserved (up to 70% savings)
Seasonal / burst       → Savings plans (flexible commitment)
Unpredictable / dev    → Stay on-demand (flexibility > savings)
Spot-capable workloads → Spot instances (up to 90% savings)
```

**Spot / preemptible instance strategy:**

```typescript
// Stateful workloads: Use spot with fallback
const computeStrategy = {
  primary: 'spot',           // 90% cheaper
  fallback: 'on-demand',     // When spot is unavailable
  maxSpotPrice: 0.50,        // Don't pay more than 50% of on-demand
  interruptionBehavior: 'stop', // Save state, resume later
};

// Stateless workloads: Pure spot with auto-scaling
const workerPool = {
  instanceType: 'c5.xlarge',
  capacity: 'spot-only',
  minSize: 2,
  maxSize: 50,
  targetCPU: 70,
};
```

### Step 6: Implement and Monitor

Every optimization must be measurable:

```markdown
## Optimization: [Name]

### Baseline
- Monthly cost: $[X]
- Primary driver: [compute/storage/network]
- Waste identified: [specific resources]

### Changes Made
1. [Change 1 with justification]
2. [Change 2 with justification]

### Results
- New monthly cost: $[Y] ([Z]% reduction)
- Performance impact: [none / improved / degraded — quantify]
- Reliability impact: [none / improved / degraded — quantify]

### Ongoing Monitoring
- Alert if cost exceeds $[threshold]
- Review monthly on [date]
- Re-evaluate if traffic changes > 20%
```

## Architecture Patterns for Cost Efficiency

### Design for Scale-to-Zero

```typescript
// Serverless functions for intermittent workloads
// Pay only for invocations, not idle time
export async function processWebhook(event: APIGatewayEvent) {
  // Cold start: ~200ms (acceptable for async processing)
  // Runtime: $0.20 per million requests vs $72/month for smallest VM
  await validateWebhook(event);
  await enqueueForProcessing(event.body);
  return { statusCode: 202 };
}
```

### Caching to Reduce Compute

```text
CACHE HIERARCHY (cheapest to most expensive):
1. Browser cache (free for you)
2. CDN edge cache (pennies per GB)
3. Application cache (memory — cheap but limited)
4. Database cache (query cache, materialized views)
5. Re-compute (most expensive)
```

### Data Transfer Minimization

```bash
# BAD: Client → API → Database → API → Client (4 hops)
# GOOD: Client → CDN (cache hit) — 1 hop, $0.01/GB

# BAD: Cross-region replication for all data
# GOOD: Replicate metadata only, fetch data on-demand

# BAD: NAT Gateway for all outbound traffic ($0.045/GB)
# GOOD: VPC endpoints for AWS services ($0/GB)
```

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We're too small for cost optimization to matter" | A single oversized database or forgotten dev environment can cost $500+/month. That's $6K/year — enough for a junior engineer's salary in many markets. |
| "Optimization will hurt performance" | Proper optimization *improves* performance. Rightsizing forces you to fix inefficiencies. Caching reduces latency. |
| "We'll just scale vertically" | Vertical scaling is the most expensive option. Horizontal scaling with smaller instances + auto-scaling is cheaper and more resilient. |
| "Reserved capacity locks us in" | Savings plans and convertible reserved instances provide flexibility. The "lock-in" cost is usually < 10% of the savings. |
| "Engineer time is more expensive than cloud costs" | True for small optimizations, but a single rightsizing exercise can save $10K+/year — that's more than the engineering time spent. |

## Red Flags

- Cloud bill is reviewed only when finance complains
- No tagging strategy (can't allocate costs to teams/products)
- "We'll optimize later" — later never comes
- All environments run 24/7 (dev/staging should auto-shutdown)
- Using latest instance types without comparing price/performance
- Data transfer costs > 15% of total bill
- No auto-scaling (manually sized for peak, paying for peak 24/7)

## Verification

After optimization:

- [ ] Costs reduced by target amount (quantified)
- [ ] Performance metrics unchanged or improved
- [ ] Reliability metrics unchanged or improved
- [ ] Monitoring and alerts updated for new baseline
- [ ] Team trained on new cost-aware practices
- [ ] Review scheduled (monthly for first 3 months, then quarterly)

## See Also

- For performance optimization alongside cost work, see `performance-optimization`
- For infrastructure decisions, see `observability-and-instrumentation` (you need metrics to optimize)
