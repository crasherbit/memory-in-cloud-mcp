# Area: E-Service Domain

## Purpose
Manages e-service (digital service) definitions, descriptors, versioning, and the catalog of services offered by providers.

## Key Packages
- `packages/catalog-process` - E-service catalog process and state management
- `packages/catalog-platformstate-writer` - Event sourcing state writer
- `packages/catalog-outbound-writer` - Integration with external systems
- `packages/catalog-readmodel-writer-sql` - SQL read model persistence

## Key Paths
- `packages/catalog-process/src/model/domain/` - e-service validators and converters
- `packages/catalog-process/src/resources/templates/` - Document templates
- `packages/models/proto/v2/eservice/` - Protobuf definitions

## Dependencies
- Depends: `models`, `commons`, `readmodel-models`
- Used by: `backend-for-frontend`, `api-gateway`, `agreement-process`
