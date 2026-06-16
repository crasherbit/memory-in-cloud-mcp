# Area: Gateway Domain

## Purpose
Provides API gateways (REST APIs) for frontend, M2M communication, and legacy services. Exposes domain operations via HTTP endpoints.

## Key Packages
- `packages/api-gateway` - REST API gateway for consumer/producer operations
- `packages/m2m-gateway` - Machine-to-machine communication gateway (legacy v2)
- `packages/m2m-gateway-v3` - M2M gateway version 3 (current)
- `packages/backend-for-frontend` - Frontend BFF (Backend For Frontend)

## Key Paths
- `packages/api-gateway/src/routes/` - API endpoint definitions
- `packages/m2m-gateway-v3/src/routes/` - M2M endpoint definitions
- `packages/backend-for-frontend/src/routes/` - BFF endpoint definitions
- `packages/api-clients/open-api/` - OpenAPI specifications

## Dependencies
- Depends: `models`, `commons`, `api-clients`, `authorization-server`
- Depends on: All domain processes and read models
- Used by: Frontend clients, external systems, internal services
