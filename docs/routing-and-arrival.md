# Routing, ETA and Arrival Notes

The mobile apps call only the MyFixer backend for route calculations. The backend selects the routing provider from environment configuration and currently supports OSRM.

Development may use the public OSRM demo server for light manual testing only. Staging is not suitable for load testing while it points at the public demo server. Production must use a self-hosted OSRM endpoint or another backend-configured provider by setting `OSRM_BASE_URL`; mobile app code does not need to change.

`OSRM_BASE_URL` is intentionally blank in production config so production fails clearly until real routing infrastructure is configured.

The current route cache is in memory. The current routing rate limiter is also in memory. This is acceptable for one backend server instance, but both must move to Redis before running multiple backend instances horizontally.

Arrival confirmation is backend verified. The technician app can prompt the technician when GPS appears to be inside the service radius, but the backend is the source of truth and uses the booking's stored service coordinates. Arrival does not start the job, complete the job, create an invoice, or trigger payment.

Arrival confirmation readings are stored on the booking document in MongoDB metadata under `arrivalConfirmation`. The stored readings are bounded to the latest five readings for the booking. This is persistent across backend restarts; a restart does not corrupt booking state. Repeated requests after a booking is already `ARRIVED` return idempotent success.

Current configurable arrival settings:

- `ARRIVAL_RADIUS_METERS`
- `ARRIVAL_CONFIRMATION_SECONDS`
- `ARRIVAL_REQUIRED_READINGS`
- `ARRIVAL_MAX_GPS_ACCURACY_METERS`
- `ARRIVAL_MAX_READING_AGE_SECONDS`
