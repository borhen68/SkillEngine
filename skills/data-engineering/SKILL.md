---
name: data-engineering
description: Guides data pipeline design, ETL/ELT workflows, schema evolution, and data quality assurance. Use when building data pipelines, designing data warehouses, migrating schemas, or ensuring data integrity across systems. Use when you need reliable, testable, and observable data flows.
---

# Data Engineering

## Overview

Data engineering is the foundation of every data-driven decision. Bad data pipelines silently corrupt analytics, break ML models, and lead to business decisions based on false premises. This skill covers designing pipelines that are correct, observable, and resilient — from ingestion to serving.

**The data engineering contract:** Every pipeline must guarantee that what lands in the destination is what the source intended, or it must fail loudly. Silent data corruption is the worst failure mode.

## When to Use

- Building ETL, ELT, or streaming data pipelines
- Designing data warehouse schemas (star, snowflake, data vault)
- Migrating data between systems or formats
- Setting up data quality monitoring and anomaly detection
- Creating CDC (change data capture) pipelines
- Building feature stores for machine learning
- Handling schema evolution without breaking consumers

**NOT for:**
- Simple one-off data exports (use a script)
- Real-time systems with sub-second latency requirements (use stream processing)
- Data science / analysis work (this skill is about moving and transforming data, not interpreting it)

## The Data Pipeline Process

### Step 1: Define the Data Contract

Before writing any pipeline code, define what correctness means:

```text
DATA CONTRACT:
├── Source: [system, table, API, file format]
├── Destination: [system, table, format]
├── Schema: [field names, types, nullability, defaults]
├── Volume: [records/day, peak throughput, growth rate]
├── Latency: [batch hourly / batch daily / streaming / near-real-time]
├── Quality rules: [uniqueness, referential integrity, range checks]
├── Retention: [how long to keep, compliance requirements]
└── SLA: [acceptable downtime, max lag, error rate threshold]
```text

**Schema definition example:**

```yaml
# data_contract.yaml
source:
  system: production_postgres
  table: orders
  
destination:
  system: snowflake
  schema: analytics
  table: fact_orders
  
schema:
  order_id: { type: BIGINT, nullable: false, unique: true }
  customer_id: { type: BIGINT, nullable: false }
  order_date: { type: TIMESTAMP, nullable: false }
  amount: { type: DECIMAL(10,2), nullable: false, min: 0 }
  status: { type: VARCHAR(20), nullable: false, enum: [pending, paid, shipped, cancelled] }
  
quality_rules:
  - column: order_id
    check: not_null
  - column: amount
    check: range
    min: 0
    max: 100000
  - table: fact_orders
    check: referential_integrity
    references: dim_customers.customer_id
```text

### Step 2: Choose the Right Pattern

```text
WORKLOAD TYPE → PATTERN
─────────────────────────────────────────────────
Batch, hourly/daily         → Scheduled ETL (Airflow, Dagster, Prefect)
Streaming, < 5 min latency  → Stream processing (Flink, Spark Streaming, Kafka Streams)
Event-driven, sporadic      → Function-as-a-service triggers (Lambda, Cloud Functions)
Micro-batch, 5-30 min       → Incremental batch with watermarking
One-time migration          → Bulk load with validation, not a pipeline
```text

### Step 3: Design for Failure

Data pipelines fail in predictable ways. Design for them:

```text
FAILURE MODE → MITIGATION
─────────────────────────────────────────────────
Source system down        → Circuit breaker + exponential backoff
Schema drift              → Schema registry + compatibility checks
Data volume spike         → Auto-scaling + backpressure
Duplicate records         → Idempotency key + deduplication
Partial load              → Transactional loads (all-or-nothing)
Late-arriving data        → Watermarking + reprocessing triggers
Downstream unavailable    → Dead letter queue + retry with backoff
```text

**Idempotent load pattern:**

```python
# Idempotent load: same input produces same output, no duplicates
def load_orders(batch_id, orders_df):
    # Use merge/upsert instead of append
    destination_table.merge(
        source=orders_df,
        target_alias='tgt',
        source_alias='src',
        on='order_id',
        when_matched_update_all=True,
        when_not_matched_insert_all=True
    )
    # Track batch in metadata table
    log_batch_completion(batch_id, len(orders_df))
```text

### Step 4: Implement Quality Gates

Every pipeline stage should validate data:

```python
# Quality gate example
from great_expectations import validate

def quality_gate(df, checks):
    results = validate(df, checks)
    
    if results['success']:
        return df
    
    # Fail fast: don't load bad data
    failed_expectations = [
        r for r in results['results'] 
        if not r['success']
    ]
    
    alert_data_team(
        pipeline='orders_etl',
        batch_id=get_batch_id(),
        failures=failed_expectations
    )
    
    raise DataQualityError(
        f"Quality gate failed: {len(failed_expectations)} checks failed"
    )

# Usage
checks = {
    'expect_column_values_to_not_be_null': ['order_id', 'customer_id'],
    'expect_column_values_to_be_between': {
        'column': 'amount',
        'min': 0,
        'max': 100000
    },
    'expect_column_values_to_be_in_set': {
        'column': 'status',
        'value_set': ['pending', 'paid', 'shipped', 'cancelled']
    }
}

quality_gate(transformed_df, checks)
```text

### Step 5: Make It Observable

You can't debug a data pipeline with application logs alone:

```python
# Pipeline telemetry
@pipeline_monitor('orders_etl')
def run_pipeline():
    metrics = {
        'pipeline': 'orders_etl',
        'batch_id': generate_batch_id(),
        'start_time': datetime.utcnow(),
    }
    
    try:
        # Extract
        raw = extract_from_source()
        metrics['extracted_rows'] = len(raw)
        
        # Transform
        transformed = apply_transforms(raw)
        metrics['transformed_rows'] = len(transformed)
        metrics['null_rate'] = calculate_null_rate(transformed)
        
        # Quality gate
        quality_gate(transformed, checks)
        metrics['quality_passed'] = True
        
        # Load
        load_to_destination(transformed)
        metrics['loaded_rows'] = len(transformed)
        
        metrics['status'] = 'success'
        metrics['duration_ms'] = (datetime.utcnow() - metrics['start_time']).total_seconds() * 1000
        
    except Exception as e:
        metrics['status'] = 'failed'
        metrics['error'] = str(e)
        raise
    finally:
        emit_pipeline_metrics(metrics)
```text

**Key metrics to emit:**

| Metric | Why It Matters |
|--------|---------------|
| `extracted_rows` | Detects source schema changes or upstream failures |
| `transformed_rows` | Catches filtering logic errors |
| `loaded_rows` | Verifies end-to-end completeness |
| `null_rate` | Early warning for data quality degradation |
| `duration_ms` | Performance regression detection |
| `error_rate` | Reliability tracking |
| `lag_seconds` | Freshness — how stale is the data? |

### Step 6: Handle Schema Evolution

Schema changes are inevitable. Handle them without breaking consumers:

```text
SCHEMA EVOLUTION RULES:
1. ADD columns: Safe. Add as nullable with sensible defaults.
2. REMOVE columns: Deprecation cycle. Mark unused, wait 30 days, then remove.
3. RENAME columns: Don't. Add new, deprecate old, remove old after cycle.
4. CHANGE types: Migration required. Backfill with casting logic.
5. CHANGE nullability: Dangerous. Requires data backfill + consumer notification.
```text

**Schema registry pattern:**

```python
# Register schema versions
schema_registry.register(
    subject='orders-value',
    schema=AvroSchema({
        'type': 'record',
        'name': 'Order',
        'fields': [
            {'name': 'order_id', 'type': 'long'},
            {'name': 'customer_id', 'type': 'long'},
            {'name': 'amount', 'type': 'double'},
            # NEW FIELD: added in v2, backward compatible
            {'name': 'discount_code', 'type': ['null', 'string'], 'default': None},
        ]
    }),
    compatibility='BACKWARD'  # New readers can read old data
)
```text

## Data Quality Framework

### The Five Dimensions of Data Quality

```text
1. COMPLETENESS → Are all expected records present?
   └── Check: Row count vs expected, null rates, missing partitions

2. ACCURACY → Do values reflect reality?
   └── Check: Range checks, referential integrity, business rule validation

3. CONSISTENCY → Is the same data the same everywhere?
   └── Check: Cross-system reconciliation, eventual lag monitoring

4. TIMELINESS → Is data fresh enough for its use case?
   └── Check: Pipeline lag, partition completeness, SLA adherence

5. UNIQUENESS → Are there duplicates?
   └── Check: Primary key constraints, idempotency verification
```text

### Data Reconciliation Pattern

```sql
-- Daily reconciliation between source and warehouse
WITH source_counts AS (
  SELECT DATE(created_at) as dt, COUNT(*) as cnt
  FROM production.orders
  WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY 1
),
warehouse_counts AS (
  SELECT DATE(order_date) as dt, COUNT(*) as cnt
  FROM analytics.fact_orders
  WHERE order_date >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY 1
)
SELECT 
  s.dt,
  s.cnt as source_count,
  w.cnt as warehouse_count,
  ABS(s.cnt - w.cnt) as diff,
  CASE 
    WHEN ABS(s.cnt - w.cnt) > (s.cnt * 0.01) THEN 'ALERT'
    ELSE 'OK'
  END as status
FROM source_counts s
LEFT JOIN warehouse_counts w ON s.dt = w.dt
ORDER BY s.dt DESC;
```text

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We'll fix data quality issues downstream" | Downstream fixes are expensive and error-prone. Fix at the source or at ingestion. Every transformation step that receives dirty data compounds the problem. |
| "Schema changes are rare" | They happen constantly — new features, new tracking, new regulations. Not having a schema evolution strategy means fire drills. |
| "Our data is small, we don't need this" | Small data grows. Building quality gates when you have 1M rows is easier than retrofitting them at 1B rows. |
| "The pipeline works, that's enough" | "Works" means nothing without data quality validation. A pipeline that loads 100% of rows with 50% nulls in key fields is broken. |
| "We'll add observability later" | You need observability to debug the first failure. Add it when you build the pipeline, not after it breaks. |

## Red Flags

- No data quality checks in the pipeline
- Schema changes applied directly without compatibility testing
- Pipelines running without monitoring or alerting
- "We think the data is correct" instead of "We've proven the data is correct"
- Manual fixes to production data without logging the change
- No reconciliation between source and destination
- Data consumers discovering schema changes before pipeline owners
- Pipelines with no retry logic or dead letter queues

## Verification

Before a pipeline goes to production:

- [ ] Data contract is documented and agreed upon by consumers
- [ ] Schema is versioned and registered
- [ ] Quality gates validate all five dimensions (completeness, accuracy, consistency, timeliness, uniqueness)
- [ ] Pipeline is idempotent (rerunning doesn't create duplicates)
- [ ] Failure modes are handled (retry, circuit breaker, dead letter queue)
- [ ] Metrics are emitted and dashboards exist
- [ ] Reconciliation query runs daily and alerts on mismatch
- [ ] Schema evolution strategy is documented
- [ ] Rollback procedure exists for bad loads

## See Also

- For testing data pipelines, follow `test-driven-development`
- For handling failures, use `debugging-and-error-recovery`
- For monitoring and alerting, see `observability-and-instrumentation`
