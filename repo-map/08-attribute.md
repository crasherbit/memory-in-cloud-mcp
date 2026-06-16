# Area: Attribute Domain

## Purpose
Manages certifications and attributes of organizations (PA, private sector entities). Handles attribute types, sources, and lifecycle.

## Key Packages
- `packages/attribute-registry-process` - Attribute process and state management
- `packages/attribute-registry-readmodel-writer-sql` - SQL read model persistence

## Key Paths
- `packages/attribute-registry-process/src/model/domain/` - attribute validators
- `packages/models/proto/v1/attribute/` - Protobuf v1 definitions (legacy)

## Dependencies
- Depends: `models`, `commons`, `readmodel-models`
- Used by: `backend-for-frontend`, `api-gateway`, `agreement-process`, `purpose-process`
