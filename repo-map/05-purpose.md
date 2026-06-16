# Area: Purpose Domain

## Purpose
Manages purposes (intentions for consuming services), risk analysis, purpose templates, and purpose lifecycle state management.

## Key Packages
- `packages/purpose-process` - Purpose process and state management
- `packages/purpose-platformstate-writer` - Event sourcing state writer
- `packages/purpose-outbound-writer` - Integration with external systems
- `packages/purpose-readmodel-writer-sql` - SQL read model persistence
- `packages/purpose-template-process` - Purpose template process
- `packages/purpose-template-platformstate-writer` - Template state writer (if exists)
- `packages/purpose-template-outbound-writer` - Template outbound writer
- `packages/purpose-template-readmodel-writer-sql` - Template read model

## Key Paths
- `packages/purpose-process/src/model/domain/` - purpose validators, risk analysis
- `packages/commons/src/risk-analysis/` - Risk analysis rules by tenant type
- `packages/models/proto/v2/purpose/` - Protobuf definitions

## Dependencies
- Depends: `models`, `commons`, `readmodel-models`
- Used by: `backend-for-frontend`, `api-gateway`, `agreement-process`
