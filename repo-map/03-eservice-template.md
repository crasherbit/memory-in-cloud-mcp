# Area: E-Service Template Domain

## Purpose
Manages templated e-service definitions that can be reused and instantiated, allowing producers to create multiple e-services from a single template.

## Key Packages
- `packages/eservice-template-process` - E-service template process and state management
- `packages/eservice-template-platformstate-writer` - Event sourcing state writer
- `packages/eservice-template-outbound-writer` - Integration with external systems
- `packages/eservice-template-readmodel-writer-sql` - SQL read model persistence
- `packages/eservice-template-instances-updater` - Updates instances when template changes

## Key Paths
- `packages/eservice-template-process/src/model/domain/` - template validators
- `packages/models/proto/v2/eservice-template/` - Protobuf definitions

## Dependencies
- Depends: `models`, `commons`, `readmodel-models`
- Used by: `backend-for-frontend`, `api-gateway`
