# Area: Agreement Domain

## Purpose
Manages agreement lifecycle, state transitions, event processing, and read model persistence for service agreements between providers and consumers.

## Key Packages
- `packages/agreement-process` - Agreement process events handler, validators, and business logic
- `packages/agreement-lifecycle` - Agreement lifecycle management
- `packages/agreement-platformstate-writer` - Event sourcing state writer
- `packages/agreement-outbound-writer` - Integration with external systems
- `packages/agreement-readmodel-writer-sql` - SQL read model persistence

## Key Paths
- `packages/agreement-process/src/model/domain/` - validators, converters, error definitions
- `packages/agreement-process/src/resources/templates/` - PDF templates for documents
- `packages/models/proto/v2/agreement/` - Protobuf definitions for v2

## Dependencies
- Depends: `models`, `commons`, `readmodel-models`
- Used by: `backend-for-frontend`, `api-gateway`, `m2m-gateway*`
