# Area: Notification Domain

## Purpose
Manages in-app notifications, email notifications, M2M event broadcasting, scheduled notifications, and notification configuration/persistence.

## Key Packages
### In-App Notifications
- `packages/in-app-notification-manager` - In-app notification management
- `packages/in-app-notification-dispatcher` - Routes notifications
- `packages/in-app-notification-db-models` - DB schema
- `packages/in-app-notification-cleaner` - Cleanup job
- `packages/in-app-scheduled-notification-dispatcher` - Scheduled dispatch

### M2M Events
- `packages/m2m-event-manager` - M2M event management
- `packages/m2m-event-dispatcher` - Event routing
- `packages/m2m-event-db-models` - DB schema
- `packages/m2m-event-cleaner` - Cleanup job

### Email Notifications
- `packages/email-notification-dispatcher` - Email routing
- `packages/email-sender` - Email transmission
- `packages/notification-email-sender` - Notification-specific email sender
- `packages/email-digest-dispatcher` - Digest batching
- `packages/email-scheduled-notification-dispatcher` - Scheduled email dispatch
- `packages/scheduled-email-notification-dispatcher` - Alternative scheduled dispatcher

### Notification Config
- `packages/notification-config-process` - Config process and state
- `packages/notification-config-readmodel-writer-sql` - Config read model

### Scheduled Notifications
- `packages/scheduled-notification-db-models` - DB schema
- `packages/scheduled-notification-cleaner` - Cleanup job
- `packages/scheduled-notification-scheduler` - Scheduler

### Integration
- `packages/notification-tenant-lifecycle-consumer` - Tenant lifecycle consumer
- `packages/notification-user-lifecycle-consumer` - User lifecycle consumer
- `packages/notification-commons` - Shared notification utilities

## Key Paths
- `packages/models/proto/v2/notification-config/` - Protobuf definitions
- `packages/in-app-notification-db-models/src/drizzle/` - ORM schema

## Dependencies
- Depends: `models`, `commons`, `readmodel-models`
- Bridges: All domain processes to notification system
