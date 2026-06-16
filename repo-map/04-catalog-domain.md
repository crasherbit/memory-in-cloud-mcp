# Catalog Domain (E-Services & Descriptors)

**Purpose:**  
E-service catalog management, descriptor versioning, archival, and template instances for descriptor reuse across multiple descriptors.

**Key Paths:**
- `packages/catalog-process/` — E-service creation, descriptor versioning process
- `packages/catalog-outbound-writer/` — Event projection to catalog state
- `packages/catalog-readmodel-writer-sql/` — Catalog read-side SQL projections
- `packages/catalog-platformstate-writer/` — Platform state synchronization
- `packages/eservice-descriptors-archiver/` — Hard-delete archival of obsolete descriptors
- `packages/eservice-descriptors-scheduled-archiver/` — Scheduled archival job
- `packages/eservice-template-process/` — Descriptor template lifecycle
- `packages/eservice-template-outbound-writer/` — Template instance projection
- `packages/eservice-template-readmodel-writer-sql/` — Template SQL read models
- `packages/eservice-template-instances-updater/` — Template-to-descriptor synchronization
- `packages/dtd-catalog-exporter/` — DTD catalog export utility

**Owned By:**  
Catalog team

**Depends On:**  
- core-models
- event-driven-platform

**Notes:**  
Template instance updater runs async; broken triggers can block descriptor updates.
