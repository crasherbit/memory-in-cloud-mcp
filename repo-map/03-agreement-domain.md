# Agreement Domain (Catalogo & Fruizione)

**Purpose:**  
Agreement lifecycle management between producers and consumers, including creation, activation, state transitions, and suspension.

**Key Paths:**
- `packages/agreement-process/` — Agreement lifecycle process & business logic
- `packages/agreement-lifecycle/` — Lifecycle state handlers and transitions
- `packages/agreement-outbound-writer/` — Event projection to API-consumable state
- `packages/agreement-readmodel-writer-sql/` — SQL read model projections
- `packages/agreement-platformstate-writer/` — Platform state synchronization
- `packages/compute-agreements-consumer/` — Aggregate consumer view builder

**Owned By:**  
Agreement team

**Depends On:**  
- core-models
- event-driven-platform
- catalog-domain (shared e-service/descriptor data)
- purpose-domain (agreement-to-purpose bindings)

**Notes:**  
High-cardinality domain; read-side projections are critical for API performance.
