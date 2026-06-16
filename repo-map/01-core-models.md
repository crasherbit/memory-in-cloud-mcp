# Core Models & Shared Domains

**Purpose:**  
Shared data models, type definitions, and cross-cutting domain utilities used across the platform.

**Key Paths:**
- `packages/models/` — Core entity and value-object definitions (Agreement, E-Service, Purpose, Tenant, Key, etc.)
- `packages/readmodel-models/` — Read-side projections of domain models
- `packages/in-app-notification-db-models/` — In-app notification schema definitions
- `packages/m2m-event-db-models/` — Machine-to-machine event model definitions
- `packages/scheduled-notification-db-models/` — Scheduled notification schema definitions
- `packages/tenant-kind-history-db-models/` — Tenant historical state models
- `packages/commons/` — Shared utilities (exceptions, configurations, logging, serialization)
- `packages/commons-test/` — Test fixtures and utilities

**Owned By:**  
Core domain team

**Depends On:**  
None (foundational layer)

**Notes:**  
Entry point for all other packages; breaking changes here cascade widely.
