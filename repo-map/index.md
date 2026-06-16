# pagopa/interop-be-monorepo — Repository Map Index

**Repository:** pagopa/interop-be-monorepo  
**Branch:** develop (as-is truth)  
**Monorepo Type:** PNPM workspace (131 packages)  
**Generated:** 2026-06-11

---

## Area Directory

| # | Area | Node | Purpose | Key Packages |
|---|------|------|---------|--------------|
| 01 | Core Models & Shared Domains | [core-models](./01-core-models.md) | Shared data models, type definitions, cross-cutting utilities | `models`, `readmodel-models`, `commons`, `commons-test` |
| 02 | Event-Driven Platform Core | [event-driven-platform](./02-event-driven-platform.md) | Event sourcing, platform state, event signing, audit trails | `events-signer`, `signed-objects-persister`, `application-audit` |
| 03 | Agreement Domain | [agreement-domain](./03-agreement-domain.md) | Agreement lifecycle (creation, activation, state transitions, suspension) | `agreement-process`, `agreement-lifecycle`, `agreement-outbound-writer`, `agreement-readmodel-writer-sql` |
| 04 | Catalog Domain | [catalog-domain](./04-catalog-domain.md) | E-service catalog, descriptor versioning, template instances | `catalog-process`, `eservice-descriptors-archiver`, `eservice-template-process`, `eservice-template-instances-updater` |
| 05 | Purpose Domain | [purpose-domain](./05-purpose-domain.md) | Purpose (use-case) lifecycle and bindings to agreements | `purpose-process`, `purpose-outbound-writer`, `purpose-template-process` |
| 06 | Tenant Domain | [tenant-domain](./06-tenant-domain.md) | Organization lifecycle, attributes, historical tracking, self-care integration | `tenant-process`, `tenant-kind-history-consumer`, `selfcare-client-users-updater` |
| 07 | Authorization Domain | [authorization-domain](./07-authorization-domain.md) | API client credentials, key lifecycle, token generation & validation | `authorization-process`, `authorization-server`, `client-purpose-updater`, `dpop-validation` |
| 08 | Attributes Domain | [attributes-domain](./08-attributes-domain.md) | Certified/verified/declared attributes from external sources (ANAC, IPA, ISTAT, IVASS) | `attribute-registry-process`, `*-certified-attributes-importer` packages |
| 09 | Delegation Domain | [delegation-domain](./09-delegation-domain.md) | Delegation of e-service responsibilities between organizations | `delegation-process`, `delegation-outbound-writer`, `delegation-items-archiver` |
| 10 | Notification System | [notification-system](./10-notification-system.md) | Email & in-app notifications, scheduling, templating, state tracking | `email-sender`, `in-app-notification-manager`, `scheduled-notification-scheduler` |
| 11 | API Gateways | [api-gateways](./11-api-gateways.md) | REST/gRPC entry points (public API, BFF, M2M v2/v3) | `api-gateway`, `backend-for-frontend`, `m2m-gateway`, `m2m-gateway-v3` |
| 12 | Read Model Layer | [readmodel-layer](./12-readmodel-layer.md) | Unified read-model infrastructure & query optimization | `readmodel`, `readmodel-models`, `*-readmodel-writer-sql` packages |
| 13 | Documents & Cryptography | [documents-crypto](./13-documents-crypto.md) | Document generation, digital signing, secure persistence | `documents-generator`, `documents-signer`, `audit-signer`, `events-signer` |
| 14 | Batch Jobs & Analytics | [batch-jobs-analytics](./14-batch-jobs-analytics.md) | Scheduled jobs, data export, analytics, risk analysis | `datalake-data-export`, `domains-analytics-writer`, `risk-analysis-processing` |
| 15 | External Integrations | [external-integrations](./15-external-integrations.md) | Third-party services (PN, OneTrust), compliance integrations | `pn-consumers`, `one-trust-notices` |
| 16 | Build & Infrastructure | [build-infra](./16-build-infra.md) | Monorepo configuration, tooling, CI/CD, linting | `pnpm-workspace.yaml`, `turbo.json`, `.github/workflows/` |
| 17 | Test Collections | [test-collections](./17-test-collections.md) | API test suites (Bruno/Postman), E2E validation | `collections/` |

---

## Dependency Flows

**Layer 0 (Foundation):**
- 16-build-infra, 01-core-models

**Layer 1 (Core Infrastructure):**
- 02-event-driven-platform, 12-readmodel-layer, 13-documents-crypto

**Layer 2 (Domain Logic):**
- 03-agreement-domain, 04-catalog-domain, 05-purpose-domain, 06-tenant-domain, 07-authorization-domain, 08-attributes-domain, 09-delegation-domain

**Layer 3 (User-Facing & Cross-Cutting):**
- 10-notification-system, 11-api-gateways, 14-batch-jobs-analytics, 15-external-integrations

**Layer 4 (Testing & Validation):**
- 17-test-collections

---

## Key Invariants

1. **All domain packages depend on** `core-models` and `event-driven-platform`.
2. **All read-side projections** use `readmodel-layer` infrastructure.
3. **Agreement domain depends on:** Catalog (e-service), Purpose (intention), Tenant (organization).
4. **Authorization critical for:** All API Gateway calls; token anomalies block flows.
5. **Notification System is cross-cutting:** Triggers across agreement, purpose, tenant, delegation, authorization.
6. **Event signing is non-negotiable:** Every domain event must be signed for auditability.
7. **Template pattern replicated:** Catalog (descriptors) and Purpose both use templating for reuse.
8. **Archival pattern replicated:** Descriptors and Delegations support hard-delete archival.
9. **Self-care integration is async:** Tenant user sync can lag; `check-selfcare-diff` audits drift.
10. **M2M v2 → v3 migration in progress:** Both coexist; v3 is newer architecture.

---

## Quick Navigation Tips

- **"I need to add a new agreement flow feature"** → Review 03-agreement-domain, check dependencies on 04/05/06.
- **"API contract change"** → Update 11-api-gateways, regenerate clients in `api-clients`.
- **"Token validation broken"** → Check 07-authorization-domain, especially `dpop-validation` and token checkers.
- **"Notification not firing"** → Trace through 10-notification-system, check consumer subscribers in relevant domains.
- **"Read model out of sync"** → Verify `*-readmodel-writer-sql` projections, check 12-readmodel-layer schema.
- **"Circular import error"** → Check `.madgerc` configuration in 16-build-infra.
- **"External data stale"** → Audit 08-attributes-domain importers and 15-external-integrations.

---

## File Organization Notes

- **No file contents in this index** — only structural orientation.
- **As-is develop branch** — all paths reference current state.
- **131 packages across 17 areas** — each area is independently deployable but interdependent.
- **Collections are Postman/Bruno format** — compatible with both platforms; keep in sync with API changes.
