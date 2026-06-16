# Area: Tenant Domain

## Purpose
Manages organization (tenant) information, attributes, kind history, and tenant lifecycle. Integrates with external tenant registries (Selfcare, ANAC, IPA, ISTAT, Certi/Cloud).

## Key Packages
- `packages/tenant-process` - Tenant process and state management
- `packages/tenant-outbound-writer` - Integration with external systems
- `packages/tenant-readmodel-writer-sql` - SQL read model persistence
- `packages/producer-keychain-readmodel-writer-sql` - Producer keychain storage
- `packages/tenant-kind-history-db-models` - Tenant kind history DB schema
- `packages/tenant-kind-history-consumer` - Consumes tenant kind history events

## Importers (Attribute Sources)
- `packages/anac-certified-attributes-importer` - ANAC attributes
- `packages/ipa-certified-attributes-importer` - IPA attributes
- `packages/istat-certified-attributes-importer` - ISTAT attributes
- `packages/ivass-certified-attributes-importer` - IVASS attributes
- `packages/private-certified-attributes-importer` - Private attributes

## Key Paths
- `packages/tenant-process/src/model/domain/` - tenant validators
- `packages/models/proto/v2/tenant/` - Protobuf definitions

## Dependencies
- Depends: `models`, `commons`, `readmodel-models`
- Used by: `backend-for-frontend`, `api-gateway`, all domain processes
