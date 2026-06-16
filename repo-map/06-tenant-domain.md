# Tenant Domain (Organization & Self-Care)

**Purpose:**  
Organization (tenant/PA) lifecycle, attributes, historical tracking, and self-care integration for user management.

**Key Paths:**
- `packages/tenant-process/` — Tenant creation, updates, state transitions
- `packages/tenant-outbound-writer/` — Event projection to tenant state
- `packages/tenant-readmodel-writer-sql/` — Tenant SQL read models
- `packages/tenant-kind-history-consumer/` — Track tenant kind changes (PA, GSP, etc.)
- `packages/tenant-kind-history-db-models/` — Tenant kind historical schema
- `packages/selfcare-client-users-updater/` — Sync tenant users from self-care
- `packages/selfcare-onboarding-consumer/` — Self-care onboarding event handler
- `packages/check-selfcare-diff/` — Audit tool for self-care sync anomalies

**Owned By:**  
Tenant & Identity team

**Depends On:**  
- core-models
- event-driven-platform

**Notes:**  
Historical tracking enables compliance & analytics; self-care consumers bridge external identity systems.
