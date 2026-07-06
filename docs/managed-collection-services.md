# Managed Collection Services Platform

Phase 2 introduces the first Managed Collection Services request flow. It builds on Location-Based Service Availability and uses `serviceKey=managed_collection`.

Legacy inputs using `garbage_collection` are accepted only as an alias and normalize to `managed_collection`. New code, records, APIs, and UI must use `managed_collection`.

## In Scope

- Managed Collection profile/request creation.
- Availability validation for `managed_collection`.
- Property type selection:
  - `HOUSE`
  - `APARTMENT`
  - `ESTATE`
  - `COMMERCIAL`
  - `INDUSTRIAL`
- Collection type:
  - `GENERAL_WASTE`
- Bin package:
  - `RED`
  - `GREEN`
  - `BLUE`
- Frequency:
  - `WEEKLY`
  - `TWICE_WEEKLY`
  - `MONTHLY`
- Preferred collection day.
- Next collection date calculation.
- Reminder record foundation.

## Out of Scope

- Recurring billing.
- Subscription payments.
- Truck routing.
- Fleet management.
- Driver app.
- Live truck tracking.
- Missed collection handling.
- Recycling analytics.
- WhatsApp, SMS, push, Firebase, OneSignal, or Twilio delivery.

## Backend APIs

Create a Managed Collection profile:

```text
POST /api/v1/managed-collections
```

Required customer-authenticated body:

```json
{
  "countryCode": "GH",
  "city": "Accra",
  "area": "East Legon",
  "fullAddress": "14 Example Street",
  "propertyType": "HOUSE",
  "collectionType": "GENERAL_WASTE",
  "binPackage": ["RED", "GREEN", "BLUE"],
  "frequency": "WEEKLY",
  "preferredCollectionDay": "MONDAY"
}
```

Admin list:

```text
GET /api/v1/admin/managed-collections
```

Admin reminder update:

```text
PATCH /api/v1/admin/managed-collection-reminders/:id
```

Supported payloads:

```json
{ "scheduledFor": "2026-07-06T08:00:00.000Z" }
```

```json
{ "status": "CANCELLED" }
```

## Availability Rules

The backend validates `managed_collection` before creating a profile.

- `ACTIVE`: create profile and reminder records.
- `COMING_SOON`: reject profile creation; client should join waitlist.
- `PAUSED`: reject as temporarily unavailable.
- `DISABLED`: reject or hide.

## Reminder Foundation

Creating a profile schedules two records:

- `DAY_BEFORE_COLLECTION`
- `COLLECTION_DAY`

Supported channels are modeled but not delivered:

- `IN_APP`
- `EMAIL`
- `SMS`
- `WHATSAPP`
- `PUSH`

Statuses:

- `PENDING`
- `SENT`
- `FAILED`
- `CANCELLED`

## Admin Portal

The Admin Portal includes a Managed Collection section showing:

- customer
- country
- city
- area
- collection type
- bin package
- frequency
- preferred collection day
- next collection date
- profile status
- upcoming reminders

Admins with booking update permission can reschedule or cancel reminders.

## Client App

The client app shows Managed Collection Services when the service is configured for the market.

- `ACTIVE`: opens the Managed Collection setup flow.
- `COMING_SOON`: joins waitlist.
- `PAUSED`: shows unavailable message.
- `DISABLED`: hidden.

The flow captures:

1. Location
2. Property type
3. Collection type
4. Bin package
5. Frequency
6. Preferred day
7. Confirmation

## Phase 3 Candidates

- Subscription plan pricing.
- Payment setup.
- Operational route planning.
- Collection team/driver tooling.
- Customer collection calendar.
- Reminder delivery integrations.
- Missed collection reporting.
