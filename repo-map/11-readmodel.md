# Area: Read Model Domain

## Purpose
Provides denormalized, query-optimized data models for all domains. Reads from event stream and writes to SQL database for fast queries.

## Key Packages
- `packages/readmodel` - Read model facade and coordination
- `packages/readmodel-models` - Drizzle ORM schema definitions
- Domain-specific SQL writers (see domain area files):
  - `*-readmodel-writer-sql` packages (agreement, authorization, catalog, etc.)

## Key Paths
- `packages/readmodel-models/src/drizzle/` - Drizzle ORM schema (PostgreSQL)
- `docker/readmodel-db/` - SQL initialization scripts by domain
- `packages/readmodel-models/src/types.ts` - TypeScript type definitions

## Database Schemas
- `agreement.sql` - Agreements, descriptors, consumers, producers
- `catalog.sql` - E-services, versions, descriptors
- `delegation.sql` - Delegations
- `purpose.sql` - Purposes, risk analyses
- `tenant.sql` - Organizations/tenants
- `attribute.sql` - Organization attributes
- `eservice-template.sql` - E-service templates
- `purpose-template.sql` - Purpose templates
- `notification-config.sql` - Notification configurations
- `producer-keychain.sql` - Producer keys and keychains
- `client.sql`, `client-jwk-key.sql` - Client authorization
- `producer-jwk-key.sql` - Producer keys

## Dependencies
- Depends: `models`, `commons`
- Consumed by: `api-gateway`, `backend-for-frontend`, `m2m-gateway*`
