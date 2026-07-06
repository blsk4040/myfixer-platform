# Managed Collection Operations

Phase 3 adds operations scheduling on top of Managed Collection Services profiles.

## Scope

Included:
- Collection jobs generated from active managed collection profiles.
- Daily, weekly, monthly, upcoming, overdue, missed, and completed operations views.
- Admin actions for completion, missed collections, rescheduling, and cancellation.
- Embedded collection history on each job.
- Audit logs for every admin job action.

Not included:
- Truck route optimization.
- Driver dispatch.
- Live tracking.
- Recurring billing.
- Cron-based automatic scheduling.

## Job Lifecycle

Collection jobs use fixed statuses:

- `SCHEDULED`
- `ASSIGNED`
- `IN_PROGRESS`
- `COMPLETED`
- `MISSED`
- `CANCELLED`

Profiles remain the customer service subscription/request record. Jobs are the operational instance for a specific collection date.

## Scheduling Logic

When a profile is created, a first `ManagedCollectionJob` is created for `profile.nextCollectionDate`.

When an admin marks a job completed:

1. The job status becomes `COMPLETED`.
2. A history entry is appended.
3. The profile `nextCollectionDate` is advanced.
4. A new scheduled job is created for the new profile date.

Frequency rules:

- `WEEKLY`: next matching preferred day after seven days.
- `TWICE_WEEKLY`: next collection is three days after the completed scheduled date.
- `MONTHLY`: advances one month, then finds the next matching preferred day.

The generator is request-driven for now. It runs when the admin operations endpoint is loaded and ensures each active profile has a job for its current `nextCollectionDate`.

## Admin Operations API

```http
GET /api/v1/admin/collection-operations
```

Supports filters:

- `countryCode`
- `city`
- `area`
- `collectionType`
- `status`
- `preferredDay`
- `from`
- `to`

Returns:

- `jobs`
- `metrics`
- `calendar`
- `meta`

```http
GET /api/v1/admin/managed-collections/:id
```

Returns a profile, jobs, reminders, and collection history.

```http
PATCH /api/v1/admin/collection-jobs/:id
```

Supported actions:

```json
{ "action": "MARK_COMPLETED", "notes": "Collected successfully." }
```

```json
{ "action": "MARK_MISSED", "missedReason": "Access denied.", "notes": "Security gate closed." }
```

```json
{ "action": "RESCHEDULE", "scheduledFor": "2026-07-10T09:00:00.000Z", "notes": "Customer requested new date." }
```

```json
{ "action": "CANCEL", "notes": "Customer cancelled this collection." }
```

## Permissions

The backend remains the source of truth.

- Read operations require `bookings.read`.
- Mutating collection jobs requires `bookings.update`.
- Support/read-only users can view operations but cannot mutate jobs.

## Audit Logging

Every job action writes an audit event using the production audit structure:

- `actor`
- `event`
- `request`
- `changes`
- `metadata`
- `success`

Actions use the prefix:

```text
managed_collection.job.*
```

## Admin Portal

The Admin Portal includes a Collection Operations section with:

- Metrics
- Today's collections
- Tomorrow's collections
- This week
- Overdue and missed
- Monthly calendar
- Upcoming collections
- Completed collections

Admins with update permission can:

- Mark Completed
- Mark Missed
- Reschedule
- Cancel

