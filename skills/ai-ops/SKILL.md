---
name: ai-ops
description: Guides operational excellence for AI/ML systems in production. Use when deploying models, managing inference infrastructure, monitoring model drift, or maintaining AI-powered features. Use when you need reliable, observable, and governable machine learning systems.
---

# AI Ops

## Overview

Deploying a machine learning model is the easy part. Keeping it correct, fast, fair, and cost-effective in production is where most AI projects fail. AI Ops (MLOps) bridges the gap between data science experimentation and production engineering — covering model deployment, monitoring, retraining, and governance.

**The AI Ops contract:** A model in production is software that happens to be probabilistic. It needs all the same operational rigor as any other service — plus additional checks for correctness drift, data distribution shifts, and fairness degradation.

## When to Use

- Deploying a model to production for inference
- Setting up model monitoring and drift detection
- Designing retraining pipelines and strategies
- Building feature stores and serving infrastructure
- Implementing A/B testing for model variants
- Ensuring model governance, explainability, and compliance
- Optimizing inference latency and throughput

**NOT for:**
- Model training and experimentation (this is data science work)
- Building the initial model prototype
- Pure research without production intent

## The AI Ops Process

### Step 1: Define Model Success Criteria

Before deploying, define what "working" means:

```text
MODEL SUCCESS CONTRACT:
├── Accuracy: [metric and threshold, e.g. AUC-ROC > 0.85]
├── Latency: [p50 < 50ms, p99 < 200ms]
├── Throughput: [min X requests/second]
├── Fairness: [demographic parity difference < 0.05]
├── Explainability: [SHAP/LIME available for all predictions]
├── Cost: [inference cost per request < $0.001]
└── Drift: [input distribution PSI < 0.2, concept drift < 5% accuracy drop]
```text

### Step 2: Design the Serving Architecture

```text
SERVING PATTERN SELECTION:

Latency Requirement    → Architecture
─────────────────────────────────────────────────
< 10ms (real-time)     → In-process inference (embedded model)
10-100ms (near-real)   → Dedicated inference service (containerized)
100ms-1s (interactive) → Auto-scaled inference cluster
> 1s (batch)           → Async queue + worker pool (batch inference)
```text

**Example: Containerized inference service:**

```python
# FastAPI inference service with health checks and metrics
from fastapi import FastAPI, HTTPException
from prometheus_client import Counter, Histogram
import joblib

app = FastAPI()
model = joblib.load('/models/v1.pkl')

predictions_total = Counter('model_predictions_total', 'Total predictions')
latency_histogram = Histogram('model_latency_seconds', 'Prediction latency')

@app.get('/health')
def health():
    return {
        'status': 'healthy',
        'model_loaded': model is not None,
        'model_version': '1.0.0'
    }

@app.post('/predict')
@latency_histogram.time()
def predict(features: dict):
    try:
        result = model.predict([features])
        predictions_total.inc()
        return {
            'prediction': result[0],
            'model_version': '1.0.0',
            'confidence': getattr(model, 'predict_proba', lambda x: [None])([features])[0].tolist()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```text

### Step 3: Implement Model Monitoring

Monitor three types of drift:

```text
DRIFT TYPES:
1. DATA DRIFT — Input distribution changes
   └── Example: A fraud model trained on US transactions sees EU transactions
   
2. CONCEPT DRIFT — The relationship between input and output changes
   └── Example: A recommendation model trained before a major UI redesign
   
3. LABEL DRIFT — Ground truth distribution changes
   └── Example: A medical diagnosis model sees a new disease variant
```text

**Monitoring implementation:**

```python
from scipy.stats import ks_2samp
import numpy as np

def detect_drift(reference_data, current_data, threshold=0.05):
    """
    Kolmogorov-Smirnov test for data drift.
    Returns True if drift is detected.
    """
    drift_detected = False
    report = {}
    
    for feature in reference_data.columns:
        statistic, p_value = ks_2samp(
            reference_data[feature],
            current_data[feature]
        )
        
        if p_value < threshold:
            drift_detected = True
            report[feature] = {
                'ks_statistic': statistic,
                'p_value': p_value,
                'status': 'DRIFT_DETECTED'
            }
    
    return drift_detected, report

# Usage
reference = load_training_distribution()  # Saved from training
current = load_last_hour_predictions()

drift, report = detect_drift(reference, current)
if drift:
    alert_ml_team('Data drift detected', report)
```text

### Step 4: Build Retraining Pipelines

```text
RETRAINING STRATEGY DECISION TREE:

How often does data change?
├── Rapidly (daily/hourly)     → Continuous retraining (online learning)
├── Moderately (weekly/monthly) → Scheduled batch retraining
└── Slowly (quarterly/yearly)   → Triggered retraining (on drift detection)

How expensive is retraining?
├── Cheap (< 1 hour, <$10)      → Retrain frequently, keep multiple versions
├── Moderate                    → Retrain on schedule, validate before deploy
└── Expensive (> 1 day, >$1000) → Triggered retraining only, heavy validation
```text

**Retraining pipeline pattern:**

```python
# Scheduled retraining with validation gates
def retrain_pipeline():
    # 1. Gather new training data
    new_data = fetch_data_since(last_training_date)
    
    # 2. Validate data quality
    if not validate_training_data(new_data):
        raise DataQualityError("Training data failed quality checks")
    
    # 3. Train new model
    new_model = train(new_data)
    
    # 4. Validate on holdout set
    holdout_metrics = evaluate(new_model, holdout_data)
    
    # 5. Compare to production model
    production_metrics = load_production_metrics()
    
    if holdout_metrics['accuracy'] < production_metrics['accuracy'] * 0.95:
        raise ModelQualityError("New model performs worse than production")
    
    # 6. Shadow deployment (serve predictions, don't use them)
    deploy_shadow(new_model, traffic_split=0.1)
    
    # 7. After validation period, promote
    if shadow_metrics_acceptable():
        promote_to_production(new_model)
        archive_old_model()
```text

### Step 5: Ensure Model Governance

```text
GOVERNANCE CHECKLIST:
├── Versioning: Every model has a version, training data hash, and config snapshot
├── Lineage: Can trace any prediction back to training data and model version
├── Explainability: Can explain why a specific prediction was made
├── Fairness: Regular audits for demographic bias
├── Security: Model artifacts are access-controlled, no secrets in training data
├── Compliance: GDPR right-to-explanation, CCPA opt-out mechanisms
└── Rollback: Can revert to previous model version in < 5 minutes
```text

**Model card pattern:**

```markdown
# Model Card: [Model Name] v[Version]

## Overview
- Purpose: [What does this model do?]
- Architecture: [e.g., XGBoost, Transformer, CNN]
- Training date: [Date]
- Training data: [Dataset name, size, time range]

## Performance
| Metric | Value | Evaluation Dataset |
|--------|-------|-------------------|
| Accuracy | 0.92 | Holdout (2024-01-01 to 2024-03-01) |
| F1 Score | 0.89 | Holdout |
| Latency (p99) | 45ms | Production shadow |

## Limitations
- [Known failure modes]
- [Data coverage gaps]
- [Temporal limitations]

## Fairness
| Group | Accuracy | FPR | FNR |
|-------|----------|-----|-----|
| Group A | 0.93 | 0.05 | 0.07 |
| Group B | 0.91 | 0.06 | 0.08 |

## Changelog
- v1.0.0: Initial deployment
- v1.1.0: Retrained with Q2 data, +2% accuracy
```text

## Feature Store Pattern

```python
# Feature store: Centralized, versioned feature computation
class FeatureStore:
    def __init__(self):
        self.online_store = RedisCluster()   # < 10ms lookups
        self.offline_store = Snowflake()     # Historical data
    
    def get_online_features(self, entity_id, feature_names):
        """Real-time feature serving for inference"""
        return self.online_store.hmget(f"entity:{entity_id}", feature_names)
    
    def get_offline_features(self, entity_ids, feature_names, time_range):
        """Batch feature serving for training"""
        return self.offline_store.query(f"""
            SELECT {', '.join(feature_names)}
            FROM feature_store
            WHERE entity_id IN ({', '.join(entity_ids)})
            AND timestamp BETWEEN '{time_range.start}' AND '{time_range.end}'
        """)
    
    def materialize_features(self, feature_definition):
        """Compute and store features from raw data"""
        # Run on schedule, backfill on demand
        computed = feature_definition.compute()
        self.online_store.load(computed)
        self.offline_store.load(computed)
```text

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The model is accurate, that's enough" | Accuracy is necessary but not sufficient. Latency, fairness, explainability, and drift monitoring are equally critical in production. |
| "We'll monitor after deployment" | Monitoring must be in place BEFORE deployment. You can't retroactively catch the first failure. |
| "Retraining is the data scientist's job" | Retraining is an operational pipeline. It needs CI/CD, testing, and rollback — all engineering concerns. |
| "Our model is too simple to need this" | Even a linear regression can drift, become unfair, or get exploited. Simplicity doesn't exempt you from operational rigor. |
| "We'll just use the latest model" | "Latest" is not a deployment strategy. Every model needs validation, shadow deployment, and a rollback plan. |

## Red Flags

- Model deployed without monitoring
- No holdout evaluation before production promotion
- Retraining is manual and ad-hoc
- Can't explain why a specific prediction was made
- No model versioning or lineage tracking
- Training data is not access-controlled
- Predictions are served synchronously without timeout handling
- No A/B testing framework for model variants

## Verification

Before an AI system goes to production:

- [ ] Model success criteria are defined and measurable
- [ ] Serving architecture meets latency and throughput requirements
- [ ] Monitoring detects data drift, concept drift, and performance degradation
- [ ] Retraining pipeline is automated and validated
- [ ] Model card is complete and reviewed
- [ ] Shadow deployment validated the model against production traffic
- [ ] Rollback procedure is tested and documented
- [ ] Explainability mechanism works for all predictions
- [ ] Fairness audit passed for relevant demographic groups
- [ ] Security review completed (no data leakage, proper access controls)

## See Also

- For data pipeline design, see `data-engineering`
- For observability setup, see `observability-and-instrumentation`
- For testing ML systems, see `test-driven-development`
- For production deployment, see `shipping-and-launch`
