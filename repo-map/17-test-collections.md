# Test Collections & Integration Tests

**Purpose:**  
Postman/Bruno collections for API endpoint testing, E2E integration validation, and manual testing workflows.

**Key Paths:**
- `collections/` — Bruno HTTP request collections (organized by domain)
  - `collections/agreement/` — Agreement lifecycle endpoints
  - `collections/api gateway/` — API gateway test scenarios
  - `collections/attribute/` — Attribute registry endpoints
  - `collections/auth server/` — Token & auth endpoints
  - `collections/authorization/` — Client & key management
  - (additional domain-specific collections)

**Owned By:**  
QA & Testing team

**Depends On:**  
- All API packages for endpoint contracts

**Notes:**  
Collections must track API contract changes; obsolete endpoints should be documented as deprecated.
