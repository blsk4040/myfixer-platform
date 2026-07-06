# Location-Based Service Availability

Phase 1 adds the foundation for controlling which MyFixer services are available by country, city, and optional area/neighbourhood.

This layer is generic. It is not tied to garbage collection, subscriptions, route optimization, payments, or technician dispatch.

## Hierarchy

```text
Country
City
Optional area / neighbourhood
Service
Availability status
```

Statuses are fixed:

- `ACTIVE`: customers can book.
- `COMING_SOON`: customers cannot book and can join the waitlist.
- `PAUSED`: temporarily unavailable.
- `DISABLED`: hidden or blocked.

## Stable Service Keys

Services must be configured with stable keys. Labels are only for display.

Examples:

- `appliance_repair`: Appliance Repair
- `plumbing`: Plumbing
- `electrical`: Electrical
- `cleaning`: Cleaning
- `painting`: Painting
- `gardening`: Gardening
- `automotive`: Automotive
- `managed_collection`: Managed Collection Services

Future services can be added in Admin Portal by creating a new service key and label. Backend validation uses the key, not the label. Legacy `garbage_collection` inputs normalize to `managed_collection`; new records should use `managed_collection`.

## Market Setup

`MarketSetting.coverage` supports both old and new structures.

Legacy:

```json
{
  "city": "Accra",
  "status": "ACTIVE",
  "services": ["Cleaning", "Plumbing"]
}
```

Preferred:

```json
{
  "city": "Accra",
  "status": "ACTIVE",
  "services": [
    {
      "serviceKey": "appliance_repair",
      "label": "Appliance Repair",
      "status": "ACTIVE"
    },
    {
      "serviceKey": "managed_collection",
      "label": "Managed Collection Services",
      "status": "COMING_SOON"
    }
  ],
  "areas": [
    {
      "name": "East Legon",
      "status": "ACTIVE",
      "services": [
        {
          "serviceKey": "managed_collection",
          "label": "Managed Collection Services",
          "status": "COMING_SOON"
        }
      ]
    }
  ]
}
```

Area support is optional. A country can launch at city level first.

## Public API

List public active markets:

```text
GET /api/v1/markets/public
```

Get availability:

```text
GET /api/v1/markets/:country/availability
GET /api/v1/markets/:country/availability?city=Accra
GET /api/v1/markets/:country/availability?city=Accra&area=East%20Legon
```

Example response:

```json
{
  "success": true,
  "availability": {
    "countryCode": "GH",
    "countryName": "Ghana",
    "currency": "GHS",
    "city": "Accra",
    "area": "East Legon",
    "services": [
      {
        "serviceKey": "appliance_repair",
        "label": "Appliance Repair",
        "status": "ACTIVE",
        "canBook": true,
        "message": ""
      },
      {
        "serviceKey": "managed_collection",
        "label": "Managed Collection Services",
        "status": "COMING_SOON",
        "canBook": false,
        "message": "Managed Collection Services is coming soon in East Legon."
      }
    ]
  }
}
```

Join service waitlist:

```text
POST /api/v1/waitlist/service
```

Required body:

```json
{
  "email": "customer@example.com",
  "phone": "+233000000000",
  "countryCode": "GH",
  "city": "Accra",
  "area": "East Legon",
  "serviceKey": "managed_collection"
}
```

Duplicate waitlist entries are prevented by `email + countryCode + city + area + serviceKey`.

## Booking Validation

Booking creation validates:

```text
countryCode -> city -> optional area -> serviceKey
```

Rules:

- `ACTIVE`: booking allowed.
- `COMING_SOON`: booking rejected with a friendly message.
- `PAUSED`: booking rejected.
- `DISABLED`: booking rejected.

Frontend checks are convenience only. Backend validation is the source of truth.

## Admin Workflow

1. Open Admin Portal Settings.
2. Select or create a market.
3. Add city rows.
4. Add services with stable service keys, labels, and statuses.
5. Add optional areas when a city needs neighbourhood-level rollout.
6. Save market settings.
7. Confirm the client app service grid reflects active, coming soon, paused, and disabled states.

No backend/mobile code change should be needed to activate a configured service.

## Client App Behavior

- `ACTIVE`: service card opens booking flow.
- `COMING_SOON`: service card shows Coming Soon and allows waitlist join.
- `PAUSED`: service card shows unavailable messaging.
- `DISABLED`: service is hidden.

Signup captures country, city, and optional area/neighbourhood.

## Rollout Process

1. Configure market country.
2. Configure launch cities.
3. Configure service statuses per city.
4. Add areas only where needed.
5. Launch active services.
6. Mark future services as `COMING_SOON` to collect waitlist demand.
7. Switch a service to `ACTIVE` when operations are ready.

## Phase 2 Not Included

- Managed collection business rules.
- Waste bins.
- Subscriptions.
- Recurring collection schedules.
- Route optimization.
- Technician dispatch changes.
- Payment changes.
- Service-specific pricing changes.
- Notifications.
