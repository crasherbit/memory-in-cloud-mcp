# Attributes Domain

**Purpose:**  
Certified, verified, and declared attribute management from external authoritative sources (ANAC, ISTAT, IVASS) and private registry.

**Key Paths:**
- `packages/attribute-registry-process/` — Attribute creation and state lifecycle
- `packages/attribute-registry-readmodel-writer-sql/` — Attribute read models
- `packages/anac-certified-attributes-importer/` — ANAC (Anticorruzione) data import
- `packages/ipa-certified-attributes-importer/` — IPA (Public Admin) data import
- `packages/istat-certified-attributes-importer/` — ISTAT (Statistics) data import
- `packages/ivass-certified-attributes-importer/` — IVASS (Insurance) data import
- `packages/private-certified-attributes-importer/` — Private authority attributes

**Owned By:**  
Attributes team

**Depends On:**  
- core-models
- event-driven-platform

**Notes:**  
Batch importers run on external data feeds; stale data must be detected and refreshed.
