# Padi Project Structure Guide

Generated from the local repository at `C:\myfixer-platform`.

## 1. Repository Purpose

This repository contains the Padi platform:

- Backend API and worker services.
- Admin Portal / BackOffice.
- Client mobile app.
- Padi Pro mobile app for service providers.
- Shared environment-loading scripts and operational documentation.

The public brand is Padi and Padi Pro. Some backend package names, internal identifiers, API names, folders and historical slugs still use `myfixer` for compatibility.

## 2. Top-Level Folder Map

```text
C:\myfixer-platform
├── admin_portal
├── backend
├── config
├── docs
├── mobile_apps
│   ├── client_app
│   └── technician_app
├── .git
├── .gitignore
├── .vscode
├── .idea
└── .agents
```

### `backend`

Node.js / Express / TypeScript backend. This is the main source of truth for:

- Authentication and user accounts.
- Admin permissions.
- Service Catalogue.
- Markets.
- Booking and dispatch.
- Quotes, invoices, payments and payouts.
- Notifications.
- Support tickets and chat.
- Reviews, referrals and reputation.
- Worker queue, Redis and Socket.IO.

### `admin_portal`

Browser-based Admin Portal / Padi BackOffice. It is a small web app with most UI logic in `src/app.js` and styling in `src/styles.css`.

### `mobile_apps/client_app`

React Native / Expo app for customers. Public name: Padi.

### `mobile_apps/technician_app`

React Native / Expo app for service providers. Public name: Padi Pro. The folder is still named `technician_app` for internal compatibility.

### `config`

Shared scripts and environment files used to start apps with the correct platform configuration.

### `docs`

Project notes, launch readiness documents, setup notes and generated project documentation.

## 3. Backend Structure

```text
backend
├── src
│   ├── config
│   ├── controllers
│   ├── database
│   ├── middleware
│   ├── models
│   ├── modules
│   ├── routes
│   ├── services
│   ├── sockets
│   ├── types
│   ├── utils
│   ├── server.ts
│   └── worker.ts
├── scripts
├── docs
├── dist
├── node_modules
├── package.json
└── tsconfig.json
```

### Backend Important Files

| Path | Purpose |
| --- | --- |
| `backend/src/server.ts` | Main HTTP/API and Socket.IO server entry point. |
| `backend/src/worker.ts` | Background worker process for queued jobs such as notifications and side effects. |
| `backend/src/routes/api.routes.ts` | Main API route registration. |
| `backend/src/controllers` | HTTP request handlers. |
| `backend/src/models` | Mongoose models and schema definitions. |
| `backend/src/services` | Business logic used by controllers and workers. |
| `backend/src/middleware` | Auth, role checks, rate limits and request protection. |
| `backend/src/sockets` | Socket.IO support and live event plumbing. |
| `backend/scripts` | Test, seed, audit, maintenance and readiness scripts. |
| `backend/dist` | Compiled output from TypeScript build. Do not edit manually. |
| `backend/node_modules` | Installed dependencies. Do not edit or commit. |

### Backend Commands

Run from `backend`:

```powershell
npm run dev
npm run worker:dev
npm run typecheck
npm run build
npm run test:services
npm run test:markets
npm run test:support
npm run test:chat-safety
npm run test:load-readiness
```

### Backend System Areas

| Area | Typical Files |
| --- | --- |
| Authentication | `controllers/auth.controller.ts`, `middleware/auth.middleware.ts`, `models/user.model.ts` |
| Service Catalogue | `models/service-catalog.model.ts`, `services/service-availability.service.ts`, `scripts/service-catalog-test.ts` |
| Markets | `models/market-setting.model.ts`, `services/market-city.service.ts`, `scripts/market-lifecycle-test.ts` |
| Booking | `controllers/booking.controller.ts`, `models/booking.model.ts`, `services/booking-workflow.service.ts` |
| Dispatch | `services/matching.service.ts`, `services/dispatch-retry.service.ts`, `sockets` |
| Quotes | `controllers/quote.controller.ts`, `models/quote.model.ts`, `services/quote-workflow.service.ts` |
| Invoices | `controllers/invoice.controller.ts`, invoice email templates and invoice models |
| Payments | `controllers/payment.controller.ts`, `services/payment-workflow.service.ts`, Paystack support |
| Payouts | payout models, payout controllers and settlement services |
| Support | `controllers/support.controller.ts`, `models/support-ticket.model.ts`, `models/support-message.model.ts` |
| Notifications | `controllers/notification.controller.ts`, `models/notification.model.ts`, `services/notification.service.ts` |
| Reviews and Reputation | `models/booking-review.model.ts`, `services/provider-reputation.service.ts` |
| Referrals and Growth | customer/provider referral models and services |
| Redis/Queues | `services/worker-queue.service.ts`, `worker.ts` |

## 4. Admin Portal Structure

```text
admin_portal
├── src
│   ├── app.js
│   ├── styles.css
│   └── assets
├── assets
├── package.json
└── server.js
```

### Admin Portal Important Files

| Path | Purpose |
| --- | --- |
| `admin_portal/src/app.js` | Main Admin Portal UI, API calls, state and event handlers. |
| `admin_portal/src/styles.css` | Admin Portal layout and visual styling. |
| `admin_portal/server.js` | Local web server for the portal. |
| `admin_portal/assets` and `admin_portal/src/assets` | Admin images and static assets. |

### Admin Portal Main Areas

- Overview dashboard and market selector.
- User/staff directory and role visibility.
- Service Catalogue hierarchy.
- Markets: Countries, Cities and optional Areas.
- Service Provider review and profile/photo approval.
- Bookings and operational tracking.
- Quotes, invoices, finance and payment visibility.
- Notifications and broadcasts.
- Support Desk.
- Growth and Trust dashboard.
- Audit logs, restricted to super-admin style access.

### Admin Portal Commands

Run from `admin_portal`:

```powershell
npm run start
npm run check
node --check src/app.js
```

## 5. Client App Structure

```text
mobile_apps/client_app
├── src
│   ├── assets
│   ├── booking
│   ├── chat
│   ├── components
│   ├── config
│   ├── hooks
│   ├── navigation
│   ├── screens
│   ├── services
│   ├── sockets
│   ├── theme
│   ├── types
│   └── utils
├── android
├── ios
├── app.json
├── package.json
├── tsconfig.json
└── google-services.json
```

### Client App Important Areas

| Path | Purpose |
| --- | --- |
| `src/navigation` | App stack and bottom tab navigation. |
| `src/screens/dashboard` | Home dashboard and dynamic Service Catalogue browsing. |
| `src/screens/booking` | Booking Wizard and service request flow. |
| `src/screens/activity` | Active bookings and live progress entry point. |
| `src/screens/history` | Completed/cancelled booking history, reviews and invoice summaries. |
| `src/screens/notifications` | Alerts and Inbox screens. |
| `src/screens/profile` | Account, security, support and referral surfaces. |
| `src/services/api.service.ts` | Main typed backend API client. |
| `src/services/pushNotification.service.ts` | Push notification registration/handling. |
| `src/utils/notificationFeed.ts` | Client Alert vs Inbox routing rules. |
| `src/theme` | Colours, spacing, radius, typography and shared design tokens. |
| `src/assets/logo` | Padi logos and notification icon assets. |
| `android` | Native Android project used for APK builds. |
| `ios` | Native iOS project when generated/used. |

### Client App Public Behaviour

- Home shows dynamic Top-Level Groups from the Service Catalogue.
- Popular Services shows categories under the selected group.
- Selecting a category shows Bookable Services.
- Selecting a Bookable Service opens the Booking Wizard.
- Booking Wizard passes server-provided service key, call-out fee, inspection setting and image metadata.
- Alerts are for dispatch, system and support update notifications.
- Inbox is for invoices, quotes, receipts and booking messages.
- History shows completed/cancelled bookings, provider identity, review state and invoice summary.

### Client App Commands

Run from `mobile_apps/client_app`:

```powershell
npm start
npm run android
npm run ios
npm run typecheck
```

For Android APK work, run from `mobile_apps/client_app/android`:

```powershell
.\gradlew.bat assembleDebug
.\gradlew.bat assembleRelease
```

## 6. Padi Pro App Structure

```text
mobile_apps/technician_app
├── src
│   ├── api
│   ├── assets
│   ├── components
│   ├── config
│   ├── constants
│   ├── context
│   ├── features
│   ├── hooks
│   ├── map
│   ├── navigation
│   ├── screens
│   ├── services
│   ├── store
│   ├── types
│   └── utils
├── assets
│   └── sounds
├── android
├── ios
├── app.json
├── package.json
├── tsconfig.json
└── google-services.json
```

### Padi Pro Important Areas

| Path | Purpose |
| --- | --- |
| `src/navigation` | Padi Pro stack and tab navigation. |
| `src/screens/home` | Provider home dashboard, rating, jobs and availability summaries. |
| `src/screens/jobs` | Incoming, active, scheduled and completed job workflow. |
| `src/map` | Route, distance, ETA and arrival confirmation. |
| `src/screens/notifications` | Alerts and Inbox screens for Padi Pro. |
| `src/screens/profile` | Profile, security, service capabilities and support. |
| `src/screens/earnings` | Earnings, payout visibility and related operational data. |
| `src/services` | API, notification, auth and supporting services. |
| `src/utils/notificationFeed.ts` | Padi Pro Alert vs Inbox routing rules. |
| `assets/sounds` | Notification sounds such as `incoming_job.wav`. |
| `android` | Native Android project used for APK builds. |

### Padi Pro Public Behaviour

- Providers select specific Bookable Service capabilities, not only broad categories.
- Incoming jobs arrive through Jobs and push/in-app alerts.
- Active jobs handle arrival, inspection, quote creation and completion submission.
- Map is for live route, ETA, distance and arrival confirmation.
- Alerts are for job, support and operational notifications.
- Inbox is for quotes, invoices, receipts, payout records and formal documents.

### Padi Pro Commands

Run from `mobile_apps/technician_app`:

```powershell
npm start
npm run android
npm run ios
npm run typecheck
```

For Android APK work, run from `mobile_apps/technician_app/android`:

```powershell
.\gradlew.bat assembleDebug
.\gradlew.bat assembleRelease
```

## 7. Shared Configuration

```text
config
├── development.env
├── staging.env
├── production.env
├── load-platform-config.js
├── run-with-platform-env.js
└── node-dns-bootstrap.js
```

### Config Notes

- `run-with-platform-env.js` wraps backend, admin and mobile commands.
- `development.env`, `staging.env` and `production.env` contain shared environment values.
- App-level `.env` files can still exist inside the mobile app folders.
- Do not commit secrets, private keys or real production credentials.
- Do not print full MongoDB, Redis, Paystack or Google secrets in logs or documentation.

## 8. Native Mobile Build Outputs

### Client App

Typical Android outputs:

```text
mobile_apps/client_app/android/app/build/outputs/apk/debug/app-debug.apk
mobile_apps/client_app/android/app/build/outputs/apk/release/app-release.apk
```

### Padi Pro

Typical Android outputs:

```text
mobile_apps/technician_app/android/app/build/outputs/apk/debug/app-debug.apk
mobile_apps/technician_app/android/app/build/outputs/apk/release/app-release.apk
```

### APK Notes

- Debug APKs can be installed for local/native testing.
- Release APKs need a valid signing keystore and signing environment variables.
- Release APKs bundle JavaScript and do not require Metro.
- If an installed app says it cannot load script, it is usually a debug build expecting Metro or a release bundle issue.

## 9. Important Generated or Dependency Folders

Do not manually edit or commit these unless there is a deliberate reason:

```text
backend/dist
backend/node_modules
admin_portal/node_modules
mobile_apps/client_app/node_modules
mobile_apps/technician_app/node_modules
mobile_apps/*/android/app/build
mobile_apps/*/android/.gradle
mobile_apps/*/android/app/.cxx
```

## 10. Environment and Secret Files

Common environment files:

```text
backend/.env
mobile_apps/client_app/.env
mobile_apps/client_app/.env.production.example
mobile_apps/technician_app/.env
config/development.env
config/staging.env
config/production.env
```

These files may contain API URLs, Google client IDs, Redis config, payment config and other environment-specific values. Review carefully before pushing.

## 11. Current Validation Commands

Backend:

```powershell
cd C:\myfixer-platform\backend
npm run typecheck
npm run build
npm run test:services
npm run test:markets
```

Admin Portal:

```powershell
cd C:\myfixer-platform\admin_portal
npm run check
node --check src/app.js
```

Client App:

```powershell
cd C:\myfixer-platform\mobile_apps\client_app
npm run typecheck
```

Padi Pro:

```powershell
cd C:\myfixer-platform\mobile_apps\technician_app
npm run typecheck
```

## 12. Operational Flow Summary

### Service Catalogue

Admin Portal creates:

```text
Top-Level Group
└── Service Category
    └── Bookable Service
```

Published catalogue items flow to:

```text
Backend Service Catalogue
→ Public Availability API
→ Client App Home
→ Category Screen
→ Bookable Service selection
→ Booking Wizard
```

### Markets

Markets define where Padi operates:

```text
Country
└── City
    └── Optional Areas
```

Areas remain optional and do not control Service Catalogue visibility.

### Booking and Dispatch

```text
Client selects Bookable Service
→ Booking created
→ Backend validates market and service
→ Dispatch finds approved capable providers
→ Padi Pro receives job alert
→ Provider accepts/ignores
→ Client tracks progress
→ Quote/payment/completion workflow
→ History, Inbox, reviews and reputation update
```

### Alerts vs Inbox

Client App:

- Alerts: dispatch updates, support replies, urgent account/system notices.
- Inbox: invoices, quotes, receipts and booking messages.

Padi Pro:

- Alerts: job requests, support replies, admin broadcasts and urgent operational notices.
- Inbox: quotes, invoices, receipts, payout records, statements and formal documents.

## 13. Naming Notes

Customer-facing text should say:

- Padi
- Padi Pro
- Service Provider

Internal compatibility names that may remain:

- `myfixer` in package names, slugs, internal API names, Firebase package IDs or legacy folders.
- `technician` in internal code paths and models where changing it would be a larger migration.

## 14. Practical Developer Rules

- Do not edit generated build output manually.
- Do not commit `.env` secrets or keystore passwords.
- Backend production source is `backend/src`.
- Admin Portal UI is mostly `admin_portal/src/app.js` and `admin_portal/src/styles.css`.
- Client App UI is under `mobile_apps/client_app/src`.
- Padi Pro UI is under `mobile_apps/technician_app/src`.
- Run typechecks after mobile code changes.
- Run `npm run check` after Admin Portal changes.
- Run backend `typecheck` and `build` after backend changes.
- Keep Client App catalogue dynamic and Admin Portal as the source of truth.

