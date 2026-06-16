# Batch Jobs & Analytics

**Purpose:**  
Scheduled jobs for data export, analytics aggregation, risk analysis, and data warehouse integration.

**Key Paths:**
- `packages/datalake-data-export/` — Event data export to data lake / warehouse
- `packages/datalake-interface-exporter/` — Interface/API call metrics export
- `packages/domains-analytics-writer/` — Domain-level analytics aggregation
- `packages/risk-analysis-processing/` — Risk scoring and analysis
- `packages/m2m-event-cleaner/` — Expired M2M event archival/cleanup
- `packages/m2m-event-db-models/` — M2M event schema
- `packages/m2m-event-dispatcher/` — M2M event routing
- `packages/m2m-event-manager/` — M2M event lifecycle

**Owned By:**  
Analytics & Data team

**Depends On:**  
- core-models
- event-driven-platform

**Notes:**  
Batch jobs can be long-running; failure recovery and idempotency are required.
