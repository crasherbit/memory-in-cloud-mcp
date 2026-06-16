# Authorization Domain (API Keys & Credentials)

**Purpose:**  
API client credential management, key lifecycle, client-to-purpose bindings, and authorization token generation and validation.

**Key Paths:**
- `packages/authorization-process/` — Client & key lifecycle process
- `packages/authorization-server/` — OAuth/JWT token endpoint for external calls
- `packages/authorization-platformstate-writer/` — Platform state synchronization
- `packages/client-readmodel-writer-sql/` — Client read-side projections
- `packages/client-purpose-updater/` — Sync client-to-purpose bindings
- `packages/key-readmodel-writer-sql/` — API key read models
- `packages/producer-keychain-platformstate-writer/` — Producer key chain state
- `packages/producer-keychain-readmodel-writer-sql/` — Keychain read models
- `packages/producer-key-events-writer/` — Key event projection
- `packages/producer-key-readmodel-writer-sql/` — Producer key read models
- `packages/client-assertion-validation/` — JWT/client assertion validation
- `packages/dpop-validation/` — DPoP (Demonstration of Proof-of-Possession) validation
- `packages/async-token-generation-readmodel-checker/` — Async token state checker
- `packages/token-details-persister/` — Token metadata storage
- `packages/token-generation-readmodel-checker/` — Sync token state verification

**Owned By:**  
Authorization & Security team

**Depends On:**  
- core-models
- event-driven-platform
- tenant-domain (client ownership)

**Notes:**  
Critical for all external API calls; token lifecycle anomalies must be detected immediately.
