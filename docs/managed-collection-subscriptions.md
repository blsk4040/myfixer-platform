# Managed Collection Subscriptions

Phase 5 adds subscriptions for Managed Collection Services only.

## Scope

Included:
- Subscription plans.
- Customer subscriptions.
- Subscription invoices.
- Billing cycle date calculation.
- Admin subscription management.
- Customer subscription dashboard.
- Paystack recurring metadata placeholders.

Not included:
- Automatic charging.
- Recurring billing execution.
- Repair-service payment changes.
- Booking payment changes.

## Subscription Statuses

- `PENDING`
- `ACTIVE`
- `PAUSED`
- `CANCELLED`
- `EXPIRED`

## Billing Frequencies

- `WEEKLY`
- `MONTHLY`
- `QUARTERLY`
- `YEARLY`

## Plan Fields

Subscription plans store:

- Plan name
- Description
- Price in minor units
- Currency
- Billing frequency
- Collection frequency
- Bin package
- Collection type
- Status

Plans are managed from the Admin Portal.

## Customer Lifecycle

Customers can:

- Subscribe
- Pause
- Resume
- Cancel
- Upgrade
- Downgrade

Upgrade and downgrade switch the plan and recalculate the next billing date. They do not charge the customer automatically.

## Billing Lifecycle

Each subscription stores:

- Previous billing date
- Next billing date
- Renewal date
- Grace period end date

Grace period is currently seven days.

When a subscription is created, the first subscription invoice is generated immediately.

Admin can manually generate due invoices:

```http
POST /api/v1/admin/managed-collection-subscriptions/generate-invoices
```

This creates invoices for active subscriptions whose `nextBillingDate` is due, then advances billing dates.

## Invoices

Managed Collection subscription invoices are stored separately from repair-service invoices.

This avoids changing existing booking payment logic.

Invoices are generated as unpaid records. Automatic Paystack charging is not enabled in Phase 5.

## Paystack Recurring Metadata

Subscriptions can store safe recurring metadata:

- Provider
- Customer code
- Authorization reference
- Default method id
- Enabled flag

Raw authorization codes are not stored on the subscription.

## Reports

Admin reports include:

- Monthly recurring revenue
- Active subscriptions
- Churn
- Renewals
- Failed renewals
- Cancelled subscriptions
- Overdue invoices

## Audit

Audit logs are created for:

- Plan create/update
- Subscription create
- Pause
- Resume
- Cancel
- Upgrade
- Downgrade
- Invoice generation

