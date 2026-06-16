# Delegation Domain

**Purpose:**  
Delegation of e-service responsibilities from one organization to another, with archival support.

**Key Paths:**
- `packages/delegation-process/` — Delegation creation and lifecycle
- `packages/delegation-outbound-writer/` — Event projection to delegation state
- `packages/delegation-readmodel-writer-sql/` — Delegation read models
- `packages/delegation-items-archiver/` — Hard-delete archival of obsolete delegations

**Owned By:**  
Delegation team

**Depends On:**  
- core-models
- event-driven-platform
- tenant-domain (delegator/delegatee)
- catalog-domain (delegated e-service)

**Notes:**  
Smaller domain; shares archival pattern with catalog descriptors.
