# Read Model Layer (Query Optimization)

**Purpose:**  
Unified read-model infrastructure and schema definitions for query optimization, analytics, and audit trails.

**Key Paths:**
- `packages/readmodel/` — Core read-model query and projection utilities
- `packages/readmodel-models/` — Shared read-model schema definitions
- `packages/kpi-domains-readmodel-checker/` — KPI consistency verification

**Owned By:**  
Data team

**Depends On:**  
- core-models

**Notes:**  
Shared by all *-readmodel-writer-sql packages; schema changes require coordination across domains.
