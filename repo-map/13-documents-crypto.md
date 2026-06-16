# Documents & Cryptography (Signing & Generation)

**Purpose:**  
Document generation, cryptographic signing, and secure document persistence for agreements and contracts.

**Key Paths:**
- `packages/documents-generator/` — Dynamic document generation (Thymeleaf/templates)
- `packages/documents-signer/` — Digital signature (TSA, PKI) integration
- `packages/audit-signer/` — Event/audit log cryptographic signing
- `packages/events-signer/` — Domain event signing for integrity

**Owned By:**  
Security & Compliance team

**Depends On:**  
- core-models
- event-driven-platform

**Notes:**  
Signing is a critical security boundary; signature failures must trigger alerts and fallback workflows.
