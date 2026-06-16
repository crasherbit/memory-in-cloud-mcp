# Area: Authorization Domain

## Purpose
Manages API clients, keys, purposes, and authorization for service consumption. Handles JWT tokens, key generation, and client authentication.

## Key Packages
- `packages/authorization-process` - Authorization process and state management
- `packages/authorization-platformstate-writer` - Event sourcing state writer
- `packages/authorization-server` - Token generation and JWT validation server
- `packages/client-readmodel-writer-sql` - Client read model persistence
- `packages/key-readmodel-writer-sql` - Key read model persistence
- `packages/producer-keychain-readmodel-writer-sql` - Producer keychain read model

## Key Paths
- `packages/authorization-process/src/model/domain/` - client validators, converters
- `packages/authorization-server/src/` - token generation logic
- `packages/models/proto/v2/authorization/` - Protobuf definitions
- `packages/commons/src/auth/` - JWT, JWK, authentication shared utilities

## Dependencies
- Depends: `models`, `commons`, `readmodel-models`
- Used by: `backend-for-frontend`, `api-gateway`, `m2m-gateway*`, `agreement-process`
