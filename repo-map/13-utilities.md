# Area: Utility Services & Processors

## Purpose
Various asynchronous processors, archival jobs, data export tools, and helper services that support the core domain logic.

## Key Packages
### Document & Signature Management
- `packages/documents-generator` - Generates documents from templates
- `packages/documents-signer` - Digitally signs documents
- `packages/events-signer` - Signs events for integrity
- `packages/signed-objects-persister` - Persists signed objects
- `packages/audit-signer` - Audit trail signing

### Data Export & Analytics
- `packages/datalake-data-export` - Exports data to data lake
- `packages/datalake-interface-exporter` - Exports interface definitions
- `packages/dtd-catalog-exporter` - Exports catalog data
- `packages/domains-analytics-writer` - Writes analytics data

### Archive & Cleanup
- `packages/eservice-descriptors-archiver` - Archives old descriptors
- `packages/eservice-descriptors-scheduled-archiver` - Scheduled archival
- `packages/delegation-items-archiver` - Archives delegations

### Token & Key Management
- `packages/token-generation-readmodel-checker` - Validates token generation readmodel
- `packages/async-token-generation-readmodel-checker` - Async token validation
- `packages/token-details-persister` - Persists token details
- `packages/producer-key-events-writer` - Producer key event writer
- `packages/producer-key-readmodel-writer-sql` - Producer key readmodel

### Specialized Processors
- `packages/compute-agreements-consumer` - Processes agreement state computations
- `packages/risk-analysis-processing` - Processes risk analyses
- `packages/client-purpose-updater` - Updates client purposes
- `packages/selfcare-client-users-updater` - Syncs Selfcare users
- `packages/selfcare-onboarding-consumer` - Handles Selfcare onboarding
- `packages/tenant-kind-history-consumer` - Tracks tenant kind changes
- `packages/notification-tenant-lifecycle-consumer` - Notification tenant events
- `packages/notification-user-lifecycle-consumer` - Notification user events

### External Integrations
- `packages/pn-consumers` - Piattaforma Notifiche consumers
- `packages/one-trust-notices` - OneTrust privacy notices
- `packages/certified-email-sender` - Certified email (PEC) sender
- `packages/check-selfcare-diff` - Validates Selfcare integration

### Seeding
- `packages/notifier-seeder` - Initializes notifier data

### Security
- `packages/client-assertion-validation` - Validates client assertions
- `packages/dpop-validation` - DPoP (Demonstration of Proof-of-Possession) validation

### Platform State
- `packages/authorization-platformstate-writer` - Authorization state writer
- `packages/catalog-platformstate-writer` - Catalog state writer
- `packages/agreement-platformstate-writer` - Agreement state writer
- `packages/purpose-platformstate-writer` - Purpose state writer
- `packages/eservice-template-platformstate-writer` - Template state writer
- `packages/purpose-template-platformstate-writer` - Purpose template state writer
- `packages/producer-keychain-platformstate-writer` - Keychain state writer
- `packages/delegation-outbound-writer` - Delegation outbound writer
- `packages/tenant-outbound-writer` - Tenant outbound writer

### Application Audit
- `packages/application-audit` - Application audit logging
- `packages/application-audit-fallback` - Fallback audit mechanism

### Kafka Authentication
- `packages/kafka-iam-auth` - IAM-based Kafka authentication

## Dependencies
- Depends: `models`, `commons`, `readmodel-models`
- Subscribes to: Kafka topics from domain processes
