# MyFixer Production Deployment Checklist

Use this checklist before every production release. Do not deploy from a dirty or unverified build.

## 1. Backend

- Build from `backend/src`, not stale generated output.
- Run:
  - `npm install`
  - `npm run typecheck`
  - `npm run build`
  - `npm test`
- Start production with:
  - `npm start`
- Confirm `/api/health` returns `200`.
- Confirm all admin routes require JWT auth and admin permissions.
- Confirm `NODE_ENV=production`.
- Confirm generated `backend/dist` was rebuilt after any `src` changes.
- Confirm no stack traces, raw provider errors, authorization codes, reset tokens, or passwords are returned to API clients.

## 2. Admin Portal

- Run:
  - `npm install`
  - `npm run check`
  - `npm start`
- Confirm the deployed portal points to the production API URL.
- Confirm customer and technician accounts are blocked from the portal UI.
- Confirm `SUPER_ADMIN` can access all permitted sections.
- Confirm role-based sidebar visibility matches backend permissions.
- Confirm all dashboard sections use live API responses:
  - Overview
  - Technicians
  - Bookings
  - Quotes
  - Invoices
  - Wallet Ledger
  - Admin Users
  - Settings / Markets
  - Audit Logs
- Confirm empty states render when real API arrays are empty.
- Confirm Settings / Markets can update country, city, optional area, service key, label, and availability status.

## 3. Customer App

- Set `EXPO_PUBLIC_API_BASE_URL` to the production backend API URL.
- Set `EXPO_PUBLIC_SOCKET_URL` to the production backend socket origin when it differs from the API origin.
- Set `EXPO_PUBLIC_APP_ENV=production` for release builds so missing mobile URLs fail clearly.
- Confirm registration, login, forgot password, booking creation, quote decision, invoice viewing, and payment vault flows against production API.
- Confirm the service grid loads `/api/v1/markets/:country/availability`.
- Confirm coming-soon services can join `/api/v1/waitlist/service`.
- Confirm no production build points to a local LAN fallback URL.
- Confirm customer users cannot access admin or technician-only APIs.

## 4. Technician App

- Set `EXPO_PUBLIC_API_BASE_URL` to the production backend API URL.
- Set `EXPO_PUBLIC_SOCKET_URL` to the production backend socket origin when it differs from the API origin.
- Set `EXPO_PUBLIC_APP_ENV=production` for release builds so missing mobile URLs fail clearly.
- Confirm technician login, booking acceptance, booking status updates, quote creation, invoice finalization, wallet balance, and cashout flow.
- Confirm technician users cannot access customer payment vault APIs unless explicitly allowed by backend roles.
- Confirm unapproved/suspended technicians cannot access active technician workflows.

## 5. MongoDB Atlas

- Use a production Atlas cluster or production database, not staging seed data.
- Confirm `MONGODB_URI` is stored only in deployment secrets.
- Confirm database user has least-required permissions.
- Confirm IP access list / private networking is configured for the hosting provider.
- Confirm indexes are applied and duplicate index warnings are reviewed.
- Confirm backups and point-in-time restore are enabled.
- Confirm Atlas SRV DNS works:
  - `src/server.ts` sets IPv4-first DNS and public resolvers.
  - `scripts/seed-staging.js` sets the same DNS behavior.
  - `scripts/reset-admin-password.js` sets the same DNS behavior.

## 6. Paystack

- Store `PAYSTACK_SECRET_KEY` only in environment secrets.
- Use live Paystack keys only in production.
- Use test keys beginning with `sk_test_` for smoke/integration card tests.
- Confirm Paystack is enabled only for markets that support it.
- Confirm `authorizationCode` and `signature` are stored with `select: false`.
- Confirm card listing API never returns authorization codes or signatures.
- Confirm Paystack errors return safe generic API messages.
- Confirm card save, default, delete, and charge actions create audit logs.

## 7. Resend

- Store `RESEND_API_KEY` and `RESEND_FROM_EMAIL` only in environment secrets.
- Verify the production sending domain in Resend.
- Confirm password reset and invoice emails use `RESEND_FROM_EMAIL`.
- Confirm email service fails safely when `RESEND_API_KEY` or `RESEND_FROM_EMAIL` is missing.
- Confirm no fallback sender or test recipient is used in production.

## 8. Required Environment Variables

Backend production:

- `NODE_ENV=production`
- `PORT`
- `MONGODB_URI`
- `JWT_SECRET`
- `CORS_ORIGIN` or `CORS_ORIGINS`
- `ADMIN_PORTAL_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `PAYSTACK_SECRET_KEY`

Optional/backend operational:

- `ADMIN_SETUP_KEY`
- `TECHNICIAN_AUTO_APPROVE`
- `REDIS_ENABLED=false`
- `REDIS_URL=redis://localhost:6379`

Admin portal:

- `PORT`
- Production API URL configured in the portal connection setting or deployment wrapper.

Mobile apps:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_SOCKET_URL`
- `EXPO_PUBLIC_APP_ENV`
- `EXPO_PUBLIC_API_URL` optional legacy alias for existing local tooling only.

Staging/smoke only:

- `STAGING_SEED_ENABLED`
- `STAGING_SEED_PASSWORD`
- `STAGING_SEED_KEY`
- `STAGING_SEED_COUNTRY_CODE`
- `STAGING_SEED_ADMIN_EMAIL`
- `STAGING_SEED_CUSTOMER_EMAIL`
- `STAGING_SEED_TECHNICIAN_EMAIL`
- `STAGING_SEED_ALLOW_OVERWRITE`
- `API_BASE_URL`
- `ADMIN_TEST_EMAIL`
- `ADMIN_TEST_PASSWORD`
- `CUSTOMER_TEST_EMAIL`
- `CUSTOMER_TEST_PASSWORD`
- `TECHNICIAN_TEST_EMAIL`
- `TECHNICIAN_TEST_PASSWORD`
- `RESET_TEST_EMAIL`
- `RESET_TEST_TOKEN`
- `RESET_TEST_PASSWORD`
- `PAYSTACK_TEST_TRANSACTION_REFERENCE`
- `PAYSTACK_TEST_CHARGE_AMOUNT_MINOR`

## 9. Security Verification

- No secrets committed to source control.
- No hardcoded API keys in source or generated deployment output.
- Passwords are hashed with bcrypt.
- Passwords are never selected or returned unless explicitly required internally.
- Password reset tokens are hashed, expire, and are never returned by APIs.
- JWT secret is configured and strong.
- Admin APIs enforce backend roles and permissions.
- Frontend visibility is convenience only; backend remains the source of truth.
- Payment vault APIs never return raw authorization codes or signatures.
- Sensitive actions create audit logs using:
  - `actor`
  - `event`
  - `request`
  - `changes`
  - `metadata`
  - `success`

## 10. Configuration Checks

- Production CORS origins are configurable through `CORS_ORIGIN` or `CORS_ORIGINS`.
- Admin password reset URL uses `ADMIN_PORTAL_URL`.
- Payment provider calls require configured provider keys.
- Email service returns safe failure when Resend config is missing.
- MongoDB DNS handling is present in server and Atlas-connecting scripts.
- Admin portal API target is configurable through the connection setting/local storage.
- Redis is disabled by default and only connects when `REDIS_ENABLED=true` and `REDIS_URL` is provided.

## 11. Smoke Testing

Backend smoke test:

```bash
cd backend
npm test
```

Seed staging test data:

```bash
cd backend
npm run seed:staging
```

Run seeded smoke checks:

```powershell
$env:ADMIN_TEST_EMAIL='seed.superadmin@myfixer.test'
$env:ADMIN_TEST_PASSWORD=$env:STAGING_SEED_PASSWORD
$env:CUSTOMER_TEST_EMAIL='seed.customer@myfixer.test'
$env:CUSTOMER_TEST_PASSWORD=$env:STAGING_SEED_PASSWORD
$env:TECHNICIAN_TEST_EMAIL='seed.technician@myfixer.test'
$env:TECHNICIAN_TEST_PASSWORD=$env:STAGING_SEED_PASSWORD
npm test
```

Run Paystack test-mode checks only with a Paystack test transaction reference:

```powershell
$env:PAYSTACK_TEST_TRANSACTION_REFERENCE='your-successful-test-reference'
npm test
```

Expected smoke coverage:

- Admin login
- Forgot password request
- Admin permission checks
- Customer/technician admin rejection
- Technician review
- Booking creation and status updates
- Quote creation and approve/reject
- Invoice finalization
- Wallet balance and cashout
- Payment card list redaction
- Paystack card mutations when test fixtures are configured
- Audit log shape

## 12. npm Scripts

Backend:

- `npm run dev`: local TypeScript dev server.
- `npm run build`: compile TypeScript to `dist`.
- `npm start`: run compiled backend from `dist/server.js`.
- `npm run typecheck`: TypeScript compile check without emitting files.
- `npm test`: production smoke test.
- `npm run seed:staging`: safe staging seed script.
- `npm run reset-admin-password`: operational admin password reset script.

Admin portal:

- `npm start`: static admin portal server.
- `npm run check`: JavaScript syntax check for `src/app.js`.

## 13. Rollback Plan

- Keep the previous backend image/build available.
- Keep the previous admin portal build available.
- Before deploying, record:
  - backend build/version
  - admin portal build/version
  - database migration/seed status
  - environment variable version
- If smoke tests fail after deploy:
  - Stop traffic to the new backend.
  - Restore previous backend image/build.
  - Restore previous admin portal build if UI/API contract changed.
  - Do not roll back MongoDB data unless a confirmed destructive migration occurred.
  - Use Atlas point-in-time restore only for data corruption incidents.
  - Re-run `npm test` after rollback.
- Document incident notes and audit logs before retrying deployment.
