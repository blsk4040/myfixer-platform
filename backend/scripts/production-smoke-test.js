const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
require('../../config/load-platform-config').loadPlatformConfig({ override: true });

const API_BASE_URL = process.env.API_BASE_URL.replace(/\/$/, '');

const results = [];

const requiredSensitiveKeys = [
  'password',
  'passwordResetTokenHash',
  'passwordResetExpiresAt',
  'resetToken',
  'tokenHash',
  'authorizationCode',
  'authorization_code',
  'signature',
  'accessCode',
  'access_code',
];

const addResult = (name, status, detail = '') => {
  results.push({ name, status, detail });
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
  });

  let body = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { response, body };
};

const bodyContainsSensitiveKey = (value) => {
  if (value == null) return false;
  if (Array.isArray(value)) return value.some(bodyContainsSensitiveKey);
  if (typeof value === 'object') {
    return Object.entries(value).some(([key, nested]) =>
      requiredSensitiveKeys.includes(key) || bodyContainsSensitiveKey(nested)
    );
  }
  return false;
};

const runStep = async (name, fn) => {
  try {
    const detail = await fn();
    addResult(name, 'PASS', detail);
  } catch (error) {
    addResult(name, 'FAIL', error.message);
  }
};

const login = async (email, password) => {
  const { response, body } = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert(response.ok, `login returned ${response.status}`);
  assert(body?.token, 'login response did not include token');
  assert(!bodyContainsSensitiveKey(body.user), 'login user payload included sensitive fields');
  return body;
};

const isNewAuditShape = (log) =>
  Boolean(log?.actor && log?.event && log?.request && Object.prototype.hasOwnProperty.call(log, 'success'));

const createSeededBooking = async (customerSession, suffix, countryCode = customerSession.user?.countryCode || 'ZM') => {
  const { response, body } = await request('/bookings', {
    method: 'POST',
    token: customerSession.token,
    body: JSON.stringify({
      customer_name: customerSession.user?.name || 'Seed Customer',
      appliance_type: `Smoke Test Appliance ${suffix}`,
      fault_description: `Seeded smoke test booking ${suffix}`,
      latitude: -15.3875,
      longitude: 28.3228,
      call_out_fee: 450,
      country_code: countryCode,
      full_address: `Smoke Test Address ${suffix}, Lusaka`,
      complex_details: 'Seeded integration test only',
      city: 'Lusaka',
      area: 'Lusaka Central',
      general_area: 'Lusaka Central',
      service_key: 'appliance_repair',
      category: 'appliance_repair',
    }),
  });

  assert(response.status === 201, `create booking returned ${response.status}: ${JSON.stringify(body)}`);
  assert(body?.bookingId, 'create booking response missing bookingId');
  return body.bookingId;
};

const acceptSeededBooking = async (technicianSession, bookingId) => {
  const { response, body } = await request(`/bookings/${bookingId}/accept`, {
    method: 'POST',
    token: technicianSession.token,
    body: JSON.stringify({}),
  });

  assert(response.ok, `accept booking returned ${response.status}: ${JSON.stringify(body)}`);
  assert(body?.status === 'ACCEPTED', `booking was not accepted: ${JSON.stringify(body)}`);
};

const updateSeededBookingStatus = async (technicianSession, bookingId, status) => {
  const { response, body } = await request(`/bookings/${bookingId}/status`, {
    method: 'PATCH',
    token: technicianSession.token,
    body: JSON.stringify({ status }),
  });

  assert(response.ok, `update booking status returned ${response.status}: ${JSON.stringify(body)}`);
  assert(body?.status === status, `booking status was not ${status}: ${JSON.stringify(body)}`);
};

const createSeededQuote = async (technicianSession, bookingId, suffix) => {
  const { response, body } = await request(`/bookings/${bookingId}/quotes`, {
    method: 'POST',
    token: technicianSession.token,
    body: JSON.stringify({
      technicianNotes: `Seeded smoke quote ${suffix}`,
      lineItems: [
        {
          type: 'CALLOUT',
          label: 'Smoke callout',
          quantity: 1,
          unitAmount: 450,
          notes: 'Seeded smoke line item',
        },
        {
          type: 'LABOR',
          label: 'Smoke labor',
          quantity: 1,
          unitAmount: 150,
          notes: 'Seeded smoke line item',
        },
        {
          type: 'PART',
          label: 'Smoke part',
          quantity: 1,
          unitAmount: 250,
          notes: 'Seeded smoke line item',
        },
      ],
    }),
  });

  assert(response.status === 201, `create quote returned ${response.status}: ${JSON.stringify(body)}`);
  assert(body?.quote?.id, 'create quote response missing quote id');
  assert(body.quote.totalAmountMinor > 0, 'quote totalAmountMinor was not populated');
  return body.quote.id;
};

const decideSeededQuote = async (customerSession, quoteId, decision) => {
  const { response, body } = await request(`/quotes/${quoteId}/${decision}`, {
    method: 'POST',
    token: customerSession.token,
    body: JSON.stringify({ note: `Seeded smoke ${decision}` }),
  });

  const expectedStatus = decision === 'approve' ? 'APPROVED' : 'REJECTED';
  assert(response.ok, `${decision} quote returned ${response.status}: ${JSON.stringify(body)}`);
  assert(body?.quote?.status === expectedStatus, `quote was not ${expectedStatus}: ${JSON.stringify(body)}`);
};

const requireSmokeValue = (value, label) => {
  assert(Boolean(value), `skipped; missing ${label} because an earlier dependent smoke step failed`);
};

const getCards = async (customerSession) => {
  const { response, body } = await request('/payments/cards', { token: customerSession.token });
  assert(response.ok, `cards returned ${response.status}: ${JSON.stringify(body)}`);
  assert(Array.isArray(body), 'cards response was not an array');
  assert(!bodyContainsSensitiveKey(body), 'cards response leaked tokenized payment secrets');
  return body;
};

const getPaymentAuditActions = async (adminSession) => {
  const { response, body } = await request('/admin/audit-logs?limit=100', { token: adminSession.token });
  assert(response.ok, `audit logs returned ${response.status}: ${JSON.stringify(body)}`);
  assert(!bodyContainsSensitiveKey(body), 'audit logs leaked sensitive payment fields');
  return (Array.isArray(body?.logs) ? body.logs : [])
    .map((log) => log.event?.action || log.action)
    .filter(Boolean);
};

const main = async () => {
  let adminSession = null;
  let customerSession = null;
  let technicianSession = null;
  const seededContext = {
    technicianProfileId: '',
    approveBookingId: '',
    rejectBookingId: '',
    approvedQuoteId: '',
    rejectedQuoteId: '',
    paymentBookingId: '',
    paymentMethodId: '',
  };

  await runStep('health endpoint', async () => {
    const healthUrl = API_BASE_URL.replace(/\/api\/v1$/, '/api/health');
    const response = await fetch(healthUrl);
    assert(response.ok, `health returned ${response.status}`);
    return healthUrl;
  });

  await runStep('admin route rejects missing token', async () => {
    const { response } = await request('/admin/overview');
    assert([401, 403].includes(response.status), `expected 401/403, got ${response.status}`);
  });

  await runStep('forgot password request is generic', async () => {
    const email = process.env.RESET_TEST_EMAIL || 'nonexistent-admin-smoke@example.com';
    const { response, body } = await request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    assert(response.ok, `forgot password returned ${response.status}`);
    assert(!bodyContainsSensitiveKey(body), 'forgot password response leaked sensitive fields');
    assert(String(body?.message || '').includes('If this email exists'), 'forgot password message was not generic');
  });

  await runStep('admin login', async () => {
    if (!process.env.ADMIN_TEST_EMAIL || !process.env.ADMIN_TEST_PASSWORD) {
      addResult('admin-backed checks', 'SKIP', 'set ADMIN_TEST_EMAIL and ADMIN_TEST_PASSWORD');
      return 'skipped credentials';
    }
    adminSession = await login(process.env.ADMIN_TEST_EMAIL, process.env.ADMIN_TEST_PASSWORD);
    assert(adminSession.user?.role === 'ADMIN', 'admin credentials did not return ADMIN role');
  });

  if (adminSession?.token) {
    await runStep('admin overview with token', async () => {
      const { response, body } = await request('/admin/overview', { token: adminSession.token });
      assert(response.ok, `overview returned ${response.status}`);
      assert(!bodyContainsSensitiveKey(body), 'overview leaked sensitive fields');
      assert(body?.overview, 'overview payload missing');
    });

    await runStep('admin audit logs use new shape', async () => {
      const { response, body } = await request('/admin/audit-logs?limit=10', { token: adminSession.token });
      assert(response.ok, `audit logs returned ${response.status}`);
      const logs = Array.isArray(body?.logs) ? body.logs : [];
      if (!logs.length) return 'no audit rows yet';
      assert(logs.every(isNewAuditShape), 'one or more audit logs used the old shape');
      assert(!bodyContainsSensitiveKey(body), 'audit logs leaked sensitive fields');
    });

    await runStep('admin market settings use nested shape', async () => {
      const { response, body } = await request('/admin/markets', { token: adminSession.token });
      assert(response.ok, `markets returned ${response.status}`);
      const markets = Array.isArray(body?.markets) ? body.markets : [];
      if (!markets.length) return 'no configured markets yet';
      assert(markets.every((market) => market.identity && market.pricing && market.coverage && market.payments && market.support), 'market payload missing nested sections');
    });
  }

  await runStep('customer login and admin rejection', async () => {
    if (!process.env.CUSTOMER_TEST_EMAIL || !process.env.CUSTOMER_TEST_PASSWORD) {
      addResult('customer-backed checks', 'SKIP', 'set CUSTOMER_TEST_EMAIL and CUSTOMER_TEST_PASSWORD');
      return 'skipped credentials';
    }
    customerSession = await login(process.env.CUSTOMER_TEST_EMAIL, process.env.CUSTOMER_TEST_PASSWORD);
    assert(customerSession.user?.role === 'CUSTOMER', 'customer credentials did not return CUSTOMER role');
    const { response } = await request('/admin/overview', { token: customerSession.token });
    assert(response.status === 403, `customer admin access returned ${response.status}`);
  });

  if (customerSession?.token) {
    await runStep('customer cannot access wallet', async () => {
      const { response } = await request('/wallet', { token: customerSession.token });
      assert(response.status === 403, `customer wallet access returned ${response.status}`);
    });

    await runStep('payment cards never expose vault secrets', async () => {
      const { response, body } = await request('/payments/cards', { token: customerSession.token });
      assert(response.ok, `cards returned ${response.status}`);
      assert(!bodyContainsSensitiveKey(body), 'cards response leaked tokenized payment secrets');
    });
  }

  await runStep('technician login and payment vault rejection', async () => {
    if (!process.env.TECHNICIAN_TEST_EMAIL || !process.env.TECHNICIAN_TEST_PASSWORD) {
      addResult('technician-backed checks', 'SKIP', 'set TECHNICIAN_TEST_EMAIL and TECHNICIAN_TEST_PASSWORD');
      return 'skipped credentials';
    }
    technicianSession = await login(process.env.TECHNICIAN_TEST_EMAIL, process.env.TECHNICIAN_TEST_PASSWORD);
    assert(technicianSession.user?.role === 'TECHNICIAN', 'technician credentials did not return TECHNICIAN role');
    const { response } = await request('/payments/cards', { token: technicianSession.token });
    assert(response.status === 403, `technician payment vault access returned ${response.status}`);
  });

  await runStep('reset password completion optional fixture', async () => {
    if (!process.env.RESET_TEST_EMAIL || !process.env.RESET_TEST_TOKEN || !process.env.RESET_TEST_PASSWORD) {
      return 'skipped; set RESET_TEST_EMAIL, RESET_TEST_TOKEN, RESET_TEST_PASSWORD';
    }
    const { response, body } = await request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email: process.env.RESET_TEST_EMAIL,
        token: process.env.RESET_TEST_TOKEN,
        password: process.env.RESET_TEST_PASSWORD,
      }),
    });
    assert(response.ok, `reset password returned ${response.status}`);
    assert(!bodyContainsSensitiveKey(body), 'reset password response leaked sensitive fields');
  });

  const hasSeededSessions = Boolean(adminSession?.token && customerSession?.token && technicianSession?.token);

  await runStep('technician review', async () => {
    if (!hasSeededSessions) return 'skipped; requires seeded admin/customer/technician credentials';

    const { response, body } = await request('/admin/technicians', { token: adminSession.token });
    assert(response.ok, `technician list returned ${response.status}`);
    const technicians = Array.isArray(body?.technicians) ? body.technicians : [];
    const technician = technicians.find((row) => row.userId?.email === technicianSession.user.email);
    assert(technician?._id, 'seeded technician profile not found');
    seededContext.technicianProfileId = technician._id;

    const review = await request(`/admin/technicians/${technician._id}/review`, {
      method: 'PATCH',
      token: adminSession.token,
      body: JSON.stringify({ status: 'APPROVED' }),
    });
    assert(review.response.ok, `technician review returned ${review.response.status}: ${JSON.stringify(review.body)}`);
    assert(review.body?.technician?.approvalStatus === 'APPROVED', 'technician was not approved');
  });

  await runStep('create booking', async () => {
    if (!hasSeededSessions) return 'skipped; requires seeded admin/customer/technician credentials';
    const suffix = Date.now();
    seededContext.approveBookingId = await createSeededBooking(customerSession, `approve-${suffix}`);
    seededContext.rejectBookingId = await createSeededBooking(customerSession, `reject-${suffix}`);
    return `created ${seededContext.approveBookingId} and ${seededContext.rejectBookingId}`;
  });

  await runStep('accept seeded bookings', async () => {
    if (!hasSeededSessions) return 'skipped; requires seeded admin/customer/technician credentials';
    requireSmokeValue(seededContext.approveBookingId, 'approve booking id');
    requireSmokeValue(seededContext.rejectBookingId, 'reject booking id');
    await acceptSeededBooking(technicianSession, seededContext.approveBookingId);
    await acceptSeededBooking(technicianSession, seededContext.rejectBookingId);
  });

  await runStep('update booking status', async () => {
    if (!hasSeededSessions) return 'skipped; requires seeded admin/customer/technician credentials';
    requireSmokeValue(seededContext.approveBookingId, 'approve booking id');
    requireSmokeValue(seededContext.rejectBookingId, 'reject booking id');
    await updateSeededBookingStatus(technicianSession, seededContext.approveBookingId, 'IN_ROUTE');
    await updateSeededBookingStatus(technicianSession, seededContext.approveBookingId, 'ARRIVED');
    await updateSeededBookingStatus(technicianSession, seededContext.rejectBookingId, 'ARRIVED');
  });

  await runStep('create quote', async () => {
    if (!hasSeededSessions) return 'skipped; requires seeded admin/customer/technician credentials';
    requireSmokeValue(seededContext.approveBookingId, 'approve booking id');
    requireSmokeValue(seededContext.rejectBookingId, 'reject booking id');
    seededContext.approvedQuoteId = await createSeededQuote(technicianSession, seededContext.approveBookingId, 'approve');
    seededContext.rejectedQuoteId = await createSeededQuote(technicianSession, seededContext.rejectBookingId, 'reject');
  });

  await runStep('approve/reject quote', async () => {
    if (!hasSeededSessions) return 'skipped; requires seeded admin/customer/technician credentials';
    requireSmokeValue(seededContext.approvedQuoteId, 'approved quote id');
    requireSmokeValue(seededContext.rejectedQuoteId, 'rejected quote id');
    await decideSeededQuote(customerSession, seededContext.approvedQuoteId, 'approve');
    await decideSeededQuote(customerSession, seededContext.rejectedQuoteId, 'reject');
  });

  await runStep('finalize invoice', async () => {
    if (!hasSeededSessions) return 'skipped; requires seeded admin/customer/technician credentials';
    requireSmokeValue(seededContext.approveBookingId, 'approve booking id');
    const { response, body } = await request('/bookings/finalize-invoice', {
      method: 'POST',
      token: technicianSession.token,
      body: JSON.stringify({
        bookingId: seededContext.approveBookingId,
        proofPhoto: 'https://example.test/myfixer/smoke-proof.jpg',
      }),
    });

    assert(response.ok, `finalize invoice returned ${response.status}: ${JSON.stringify(body)}`);
    assert(body?.success === true, 'finalize invoice did not return success');
  });

  await runStep('wallet balance', async () => {
    if (!hasSeededSessions) return 'skipped; requires seeded admin/customer/technician credentials';
    const { response, body } = await request('/wallet', { token: technicianSession.token });
    assert(response.ok, `wallet balance returned ${response.status}: ${JSON.stringify(body)}`);
    assert(typeof body?.available_balance_minor === 'number', 'wallet balance missing available_balance_minor');
    assert(typeof body?.pending_balance_minor === 'number', 'wallet balance missing pending_balance_minor');
  });

  await runStep('wallet cashout', async () => {
    if (!hasSeededSessions) return 'skipped; requires seeded admin/customer/technician credentials';
    const balance = await request('/wallet', { token: technicianSession.token });
    assert(balance.response.ok, `wallet balance returned ${balance.response.status}: ${JSON.stringify(balance.body)}`);
    const availableMinor = balance.body?.available_balance_minor || 0;
    if (availableMinor < 100) return 'skipped; seeded wallet has less than 100 minor units available';

    const cashoutAmountMinor = Math.min(100, availableMinor);
    const { response, body } = await request('/wallet/cashout', {
      method: 'POST',
      token: technicianSession.token,
      body: JSON.stringify({ amountMinor: cashoutAmountMinor }),
    });

    assert(response.ok, `wallet cashout returned ${response.status}: ${JSON.stringify(body)}`);
    assert(body?.amount_minor === cashoutAmountMinor, 'wallet cashout amount mismatch');
  });

  const paymentFixtureConfigured = Boolean(process.env.PAYSTACK_TEST_TRANSACTION_REFERENCE);
  const paystackTestMode = typeof process.env.PAYSTACK_SECRET_KEY === 'string' && process.env.PAYSTACK_SECRET_KEY.startsWith('sk_test_');
  const hasPaymentFixture = Boolean(hasSeededSessions && paymentFixtureConfigured && paystackTestMode);

  await runStep('paystack fixture safety', async () => {
    if (!paymentFixtureConfigured) return 'skipped; set PAYSTACK_TEST_TRANSACTION_REFERENCE';
    assert(paystackTestMode, 'PAYSTACK_SECRET_KEY must be a Paystack test secret key starting with sk_test_');
    assert(hasSeededSessions, 'seeded admin/customer/technician credentials are required for Paystack fixture tests');
  });

  await runStep('save payment card', async () => {
    if (!hasPaymentFixture) return 'skipped; requires PAYSTACK_TEST_TRANSACTION_REFERENCE and sk_test_ key';

    const beforeCards = await getCards(customerSession);
    const { response, body } = await request('/payments/save-card', {
      method: 'POST',
      token: customerSession.token,
      body: JSON.stringify({ transactionReference: process.env.PAYSTACK_TEST_TRANSACTION_REFERENCE }),
    });

    assert([200, 201].includes(response.status), `save card returned ${response.status}: ${JSON.stringify(body)}`);
    assert(!bodyContainsSensitiveKey(body), 'save card response leaked tokenized payment secrets');

    const afterCards = await getCards(customerSession);
    const newMethodId = body?.methodId;
    const fallbackMethodId = afterCards.find((card) => card.isDefault)?.methodId || afterCards[0]?.methodId;
    seededContext.paymentMethodId = newMethodId || fallbackMethodId;

    assert(seededContext.paymentMethodId, `no saved payment method available after save. before=${beforeCards.length} after=${afterCards.length}`);
    return body?.methodId ? 'saved new card' : 'card already existed; using existing saved method';
  });

  await runStep('set default card', async () => {
    if (!hasPaymentFixture) return 'skipped; requires PAYSTACK_TEST_TRANSACTION_REFERENCE and sk_test_ key';

    const { response, body } = await request(`/payments/default/${seededContext.paymentMethodId}`, {
      method: 'PATCH',
      token: customerSession.token,
      body: JSON.stringify({}),
    });

    assert(response.ok, `set default card returned ${response.status}: ${JSON.stringify(body)}`);
    assert(!bodyContainsSensitiveKey(body), 'set default card response leaked tokenized payment secrets');
    const cards = await getCards(customerSession);
    const selected = cards.find((card) => card.methodId === seededContext.paymentMethodId);
    assert(selected?.isDefault === true, 'selected card was not marked default');
  });

  await runStep('charge saved card', async () => {
    if (!hasPaymentFixture) return 'skipped; requires PAYSTACK_TEST_TRANSACTION_REFERENCE and sk_test_ key';

    seededContext.paymentBookingId = await createSeededBooking(customerSession, `paystack-${Date.now()}`, 'ZA');
    requireSmokeValue(seededContext.paymentBookingId, 'payment booking id');
    const { response, body } = await request('/payments/charge-saved-card', {
      method: 'POST',
      token: customerSession.token,
      body: JSON.stringify({
        bookingId: seededContext.paymentBookingId,
        amountMinor: Number(process.env.PAYSTACK_TEST_CHARGE_AMOUNT_MINOR || 100),
      }),
    });

    assert(response.ok, `charge saved card returned ${response.status}: ${JSON.stringify(body)}`);
    assert(!bodyContainsSensitiveKey(body), 'charge saved card response leaked tokenized payment secrets');
    assert(body?.reference, 'charge response missing reference');
    assert(typeof body?.amountMinor === 'number', 'charge response missing amountMinor');
  });

  await runStep('delete payment card', async () => {
    if (!hasPaymentFixture) return 'skipped; requires PAYSTACK_TEST_TRANSACTION_REFERENCE and sk_test_ key';

    const { response, body } = await request(`/payments/cards/${seededContext.paymentMethodId}`, {
      method: 'DELETE',
      token: customerSession.token,
    });

    assert(response.ok, `delete card returned ${response.status}: ${JSON.stringify(body)}`);
    assert(!bodyContainsSensitiveKey(body), 'delete card response leaked tokenized payment secrets');
    const cards = await getCards(customerSession);
    assert(!cards.some((card) => card.methodId === seededContext.paymentMethodId), 'deleted card still appears in card list');
  });

  await runStep('payment audit logs created', async () => {
    if (!hasPaymentFixture) return 'skipped; requires PAYSTACK_TEST_TRANSACTION_REFERENCE and sk_test_ key';

    const actions = await getPaymentAuditActions(adminSession);
    const hasSaveAudit = actions.includes('payment_card.save') || actions.includes('payment_card.save.duplicate');
    assert(hasSaveAudit, 'missing payment_card.save audit log');
    assert(actions.includes('payment_card.set_default'), 'missing payment_card.set_default audit log');
    assert(actions.includes('payment.charge_saved_card'), 'missing payment.charge_saved_card audit log');
    assert(actions.includes('payment_card.delete'), 'missing payment_card.delete audit log');
  });

  await runStep('failed payment cases return safe errors', async () => {
    if (!customerSession?.token) return 'skipped; requires customer credentials';

    const bookingId = seededContext.paymentBookingId || seededContext.approveBookingId || await createSeededBooking(customerSession, `failed-payment-${Date.now()}`, 'ZA');
    requireSmokeValue(bookingId, 'payment failure booking id');
    const { response, body } = await request('/payments/charge-saved-card', {
      method: 'POST',
      token: customerSession.token,
      body: JSON.stringify({ bookingId, amountMinor: 0 }),
    });

    assert(response.status === 400, `invalid charge amount returned ${response.status}`);
    assert(!bodyContainsSensitiveKey(body), 'failed payment response leaked sensitive fields');
    assert(String(body?.error || body?.message || '').length > 0, 'failed payment response missing safe error message');
  });

  console.table(results);

  const failures = results.filter((result) => result.status === 'FAIL');
  if (failures.length) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
