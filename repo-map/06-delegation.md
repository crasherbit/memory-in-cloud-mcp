# Area: Delegation Domain

## Purpose
Manages delegation of agreement consumption rights from one organization to another, allowing delegation chains and delegation lifecycle management.

## Key Packages
- `packages/delegation-process` - Delegation process and state management
- `packages/delegation-outbound-writer` - Integration with external systems
- `packages/delegation-readmodel-writer-sql` - SQL read model persistence
- `packages/delegation-items-archiver` - Archives old delegation records

## Key Paths
- `packages/delegation-process/src/model/domain/` - delegation validators, converters
- `packages/models/proto/v2/delegation/` - Protobuf definitions

## Dependencies
- Depends: `models`, `commons`, `readmodel-models`
- Used by: `backend-for-frontend`, `api-gateway`
