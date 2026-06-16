# Purpose Domain

**Purpose:**  
Purpose (use-case) definition and lifecycle for agreements, including purpose state management and intention binding between consumer and e-service.

**Key Paths:**
- `packages/purpose-process/` — Purpose creation and state lifecycle
- `packages/purpose-outbound-writer/` — Event projection to purpose state
- `packages/purpose-readmodel-writer-sql/` — Purpose SQL read models
- `packages/purpose-platformstate-writer/` — Platform state synchronization
- `packages/purpose-template-process/` — Purpose template (reuse pattern)
- `packages/purpose-template-outbound-writer/` — Template instance projection
- `packages/purpose-template-readmodel-writer-sql/` — Template read models

**Owned By:**  
Purpose team

**Depends On:**  
- core-models
- event-driven-platform

**Notes:**  
Templated pattern mirrors catalog domain; templates enable purpose reuse across agreements.
