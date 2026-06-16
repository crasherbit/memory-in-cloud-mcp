# Event-Driven Platform Core

**Purpose:**  
Event sourcing infrastructure, platform state management, event signing, and event routing across all domains.

**Key Paths:**
- `packages/events-signer/` — Cryptographic signing of domain events
- `packages/signed-objects-persister/` — Persisting and retrieving signed events
- `packages/application-audit/` — Event audit trail and compliance logging
- `packages/application-audit-fallback/` — Fallback mechanisms for audit failures
- `packages/notification-commons/` — Shared notification infrastructure

**Owned By:**  
Infrastructure & Eventing team

**Depends On:**  
- core-models

**Notes:**  
Foundational for all outbound-writers and process handlers; critical for event consistency.
