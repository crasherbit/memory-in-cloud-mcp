# Notification System (Email & In-App)

**Purpose:**  
Multi-channel notifications (email, in-app) with scheduling, templating, and state tracking across all domains.

**Key Paths:**
- `packages/notification-config-process/` — Notification configuration lifecycle
- `packages/notification-config-readmodel-writer-sql/` — Config read models
- `packages/email-sender/` — Core email dispatch engine
- `packages/email-notification-dispatcher/` — Email event-triggered dispatch
- `packages/email-scheduled-notification-dispatcher/` — Scheduled email batching
- `packages/scheduled-email-notification-dispatcher/` — Email scheduler integration
- `packages/email-digest-dispatcher/` — Email digest aggregation
- `packages/certified-email-sender/` — PEC (certified email) integration
- `packages/notification-tenant-lifecycle-consumer/` — Tenant event notifications
- `packages/notification-user-lifecycle-consumer/` — User event notifications
- `packages/in-app-notification-manager/` — In-app notification orchestration
- `packages/in-app-notification-dispatcher/` — In-app event-triggered dispatch
- `packages/in-app-notification-db-models/` — In-app schema definitions
- `packages/scheduled-in-app-notification-dispatcher/` — In-app scheduler integration
- `packages/in-app-scheduled-notification-dispatcher/` — Scheduled in-app batching
- `packages/in-app-notification-cleaner/` — Retention & cleanup
- `packages/scheduled-notification-scheduler/` — Unified scheduling orchestrator
- `packages/scheduled-notification-db-models/` — Scheduler schema
- `packages/scheduled-notification-cleaner/` — Scheduler cleanup
- `packages/notifier-seeder/` — Test data seeding

**Owned By:**  
Notifications team

**Depends On:**  
- core-models
- event-driven-platform

**Notes:**  
Large interconnected subsystem; delivery guarantees are critical; dead-letter handling essential.
