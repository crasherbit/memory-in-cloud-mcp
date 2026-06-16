# API Gateways (External & M2M)

**Purpose:**  
REST/gRPC API entry points for external consumers (API Gateway, BFF) and internal machine-to-machine calls (M2M Gateway).

**Key Paths:**
- `packages/api-gateway/` — Main public REST API (Swagger/OpenAPI contracts)
- `packages/backend-for-frontend/` — BFF layer for web/mobile clients
- `packages/m2m-gateway/` — Internal service-to-service communication (legacy v2)
- `packages/m2m-gateway-v3/` — M2M service mesh (v3, newer architecture)
- `packages/api-clients/` — Generated TypeScript/API client libraries for consumption
- `packages/kafka-iam-auth/` — Kafka IAM authentication for M2M

**Owned By:**  
Platform & API team

**Depends On:**  
- core-models
- event-driven-platform
- All domain packages (for business logic invocation)

**Notes:**  
API contracts are the platform boundary; breaking changes here affect all consumers. M2M v2 → v3 migration in progress.
