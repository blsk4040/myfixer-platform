# Notification System

Phase 4 introduces a generic notification engine for MyFixer.

## Enabled Channels

Enabled in Phase 4:

- `IN_APP`
- `EMAIL`

Designed but disabled:

- `PUSH`
- `SMS`
- `WHATSAPP`

Disabled channels are represented in the model and service interface, but delivery returns a safe failed status until providers are configured in a later phase.

## Notification Lifecycle

Notifications use these statuses:

- `PENDING`
- `SCHEDULED`
- `SENT`
- `FAILED`
- `CANCELLED`
- `READ`
- `ARCHIVED`

Scheduled notifications remain `SCHEDULED` until the scheduler endpoint processes due records.

## User Preferences

Each user can enable or disable:

- In-App
- Email
- Push
- SMS
- WhatsApp

Default preferences:

- In-App: enabled
- Email: enabled
- Push: disabled
- SMS: disabled
- WhatsApp: disabled

## Scheduler

The scheduler is request-driven in Phase 4.

```http
POST /api/v1/admin/notifications/process-due
```

This processes due `PENDING`, `SCHEDULED`, and retry-eligible `FAILED` notifications.

Retry behavior:

- Failed notifications store `lastError`.
- `retryCount` increments.
- `nextRetryAt` is calculated with a small increasing delay.
- Admins can manually retry from the Notification Center.

## Managed Collection Notifications

Managed Collection Services generates:

- One day before collection: `COLLECTION_REMINDER`
- Collection today: `COLLECTION_TODAY`
- Collection missed: `COLLECTION_MISSED`
- Collection rescheduled: `COLLECTION_RESCHEDULED`
- Collection cancelled: `COLLECTION_CANCELLED`

Profile creation schedules reminder and collection-day notifications.

Collection job actions generate immediate notifications for missed, rescheduled, and cancelled collections. Completing a collection advances the next schedule and creates the next reminder/today notifications.

## Admin Notification Center

Admin portal supports:

- View notifications
- Filter by status, channel, type, user, date
- Retry failed notifications
- Cancel pending or scheduled notifications
- Process due notifications

## Client Notification Inbox

The client app supports:

- Notification list
- Unread badge count
- Mark read
- Mark unread
- Archive
- Open related collection placeholder

## Audit

Audit events are created for:

- Notification created
- Notification sent
- Notification failed
- Notification cancelled
- Notification retry
- Scheduler processing

