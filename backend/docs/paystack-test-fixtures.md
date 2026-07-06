# Paystack Test Fixtures

The production smoke test can verify tokenized card flows against Paystack test mode.

## Required

- `PAYSTACK_SECRET_KEY`: must be a Paystack test secret key beginning with `sk_test_`.
- `PAYSTACK_TEST_TRANSACTION_REFERENCE`: a successful Paystack test transaction reference that includes a reusable card authorization.
- Seeded account env vars from `docs/staging-seed.md`.

## Optional

- `PAYSTACK_TEST_CHARGE_AMOUNT_MINOR`: amount to charge in minor units. Defaults to `100`.

## Run

Start the backend, then run:

```powershell
$env:ADMIN_TEST_EMAIL='seed.superadmin@myfixer.test'
$env:ADMIN_TEST_PASSWORD=$env:STAGING_SEED_PASSWORD
$env:CUSTOMER_TEST_EMAIL='seed.customer@myfixer.test'
$env:CUSTOMER_TEST_PASSWORD=$env:STAGING_SEED_PASSWORD
$env:TECHNICIAN_TEST_EMAIL='seed.technician@myfixer.test'
$env:TECHNICIAN_TEST_PASSWORD=$env:STAGING_SEED_PASSWORD
$env:PAYSTACK_TEST_TRANSACTION_REFERENCE='your-successful-test-reference'
npm test
```

The smoke test refuses to run Paystack card mutations unless the key is test-mode.
