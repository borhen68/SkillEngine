# Reliability Checklist

Pre-production checklist for systems that must stay up. Use this when reviewing infrastructure, preparing for launch, or auditing operational readiness.

## Availability

- [ ] SLO is defined with a specific percentage (e.g., 99.9%, 99.99%)
- [ ] Error budget is calculated and tracked
- [ ] On-call rotation exists with escalation paths
- [ ] Runbooks exist for every alert and are tested quarterly
- [ ] Single points of failure are documented and accepted (or eliminated)
- [ ] The system can survive: single-node failure, single-AZ failure, single-dependency failure
- [ ] Circuit breakers or fallbacks exist for every external dependency
- [ ] Graceful degradation mode is documented and tested
- [ ] Rollback time to previous version is < 5 minutes

## Observability

- [ ] RED metrics instrumented for every service boundary
- [ ] Distributed tracing propagates context across all service calls
- [ ] Logs are structured (JSON) and correlated with trace IDs
- [ ] No PII, secrets, or tokens in log lines
- [ ] Dashboards are symptom-based (user experience), not cause-based (infrastructure)
- [ ] Every alert is actionable and has a runbook link
- [ ] Alerts were test-fired before going to production
- [ ] An induced failure in staging was located via telemetry alone
- [ ] Log retention policy meets compliance requirements

## Capacity & Scaling

- [ ] Peak utilization is < 70% of provisioned capacity
- [ ] Auto-scaling is configured with min/max bounds and cooldown periods
- [ ] Resource limits (CPU, memory, disk, file descriptors, connections) are enforced
- [ ] Load testing has been performed at 2x expected peak traffic
- [ ] Capacity plan exists for 6-12 months of growth
- [ ] Database connection pool size is appropriate and has headroom
- [ ] Queue depth/backpressure handling is configured for async systems

## Security & Compliance

- [ ] Secrets are stored in a secret manager, never in code or env vars
- [ ] Data is encrypted at rest and in transit
- [ ] Access controls follow least privilege
- [ ] Dependencies are scanned for known vulnerabilities
- [ ] Audit logging exists for sensitive operations
- [ ] Rate limiting is configured on authentication endpoints
- [ ] Security headers are configured (CSP, HSTS, X-Frame-Options)
- [ ] CORS is configured to specific origins (not wildcard)

## Data Integrity

- [ ] Database backups are automated and tested regularly
- [ ] Backup recovery time objective (RTO) is documented and tested
- [ ] Data replication lag is monitored and within acceptable bounds
- [ ] Schema changes have a rollback plan
- [ ] Data retention policy is defined and enforced

## Incident Response

- [ ] Incident classification system exists (SEV1/SEV2/SEV3)
- [ ] Communication plan exists for customer-impacting incidents
- [ ] Blameless post-mortem process is documented
- [ ] Post-mortems have action items with owners and deadlines
- [ ] Chaos engineering experiments have been run in staging
- [ ] Game day has been completed at least once

## Cost Efficiency

- [ ] Resource utilization is monitored and rightsized
- [ ] Auto-shutdown is configured for non-production environments
- [ ] Storage tiers match access patterns (hot/warm/cold)
- [ ] Reserved capacity or savings plans are used for steady-state workloads
- [ ] Data transfer costs are tracked and optimized
