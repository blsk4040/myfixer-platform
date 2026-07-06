# Staging Seed Data

This script creates safe, clearly marked test data for staging smoke and integration testing.

## Required Environment Variables

- `MONGODB_URI`: staging MongoDB connection string.
- `STAGING_SEED_ENABLED=true`: explicit safety switch.
- `STAGING_SEED_PASSWORD`: shared password for the seeded admin, customer, and technician test accounts. Must be at least 12 characters.

## Optional Environment Variables

- `STAGING_SEED_KEY`: marker used in seeded record metadata. Defaults to `myfixer-staging-seed-v1`.
- `STAGING_SEED_COUNTRY_CODE`: market/country for seeded records. Defaults to `ZM`.
- `STAGING_SEED_ADMIN_EMAIL`: defaults to `seed.superadmin@myfixer.test`.
- `STAGING_SEED_CUSTOMER_EMAIL`: defaults to `seed.customer@myfixer.test`.
- `STAGING_SEED_TECHNICIAN_EMAIL`: defaults to `seed.technician@myfixer.test`.
- `STAGING_SEED_ALLOW_OVERWRITE=true`: only use intentionally. Allows replacing records that match unique keys but are not marked with the seed key.

## Run

```bash
npm run seed:staging
```

The script refuses to run when `NODE_ENV=production`.

## Deeper Smoke Test

Start the backend, then run:

```bash
ADMIN_TEST_EMAIL=seed.superadmin@myfixer.test ADMIN_TEST_PASSWORD="$STAGING_SEED_PASSWORD" CUSTOMER_TEST_EMAIL=seed.customer@myfixer.test CUSTOMER_TEST_PASSWORD="$STAGING_SEED_PASSWORD" TECHNICIAN_TEST_EMAIL=seed.technician@myfixer.test TECHNICIAN_TEST_PASSWORD="$STAGING_SEED_PASSWORD" npm test
```

Use PowerShell syntax on Windows:

```powershell
$env:ADMIN_TEST_EMAIL='seed.superadmin@myfixer.test'
$env:ADMIN_TEST_PASSWORD=$env:STAGING_SEED_PASSWORD
$env:CUSTOMER_TEST_EMAIL='seed.customer@myfixer.test'
$env:CUSTOMER_TEST_PASSWORD=$env:STAGING_SEED_PASSWORD
$env:TECHNICIAN_TEST_EMAIL='seed.technician@myfixer.test'
$env:TECHNICIAN_TEST_PASSWORD=$env:STAGING_SEED_PASSWORD
npm test
```
