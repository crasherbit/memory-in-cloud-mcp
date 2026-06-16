# External Integrations & Compliance

**Purpose:**  
Integration with external services, regulatory compliance, and third-party data sources.

**Key Paths:**
- `packages/pn-consumers/` — Piattaforma Notifiche (PN) integration for certified notifications
- `packages/one-trust-notices/` — OneTrust privacy/consent management
- `packages/risk-analysis-processing/` — External risk analysis service integration

**Owned By:**  
Integrations team

**Depends On:**  
- core-models
- event-driven-platform

**Notes:**  
External service dependencies; retry and fallback logic critical for resilience.
