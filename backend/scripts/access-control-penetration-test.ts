import assert from 'assert';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import User, { AdminPermission, AdminRole, UserRole } from '../src/models/user.model';
import { authenticateToken, requireAdminPermission, requireRole } from '../src/middleware/auth.middleware';
import {
  AdminMarketScopeError,
  countryScopeFilter,
  getAdminMarketScope,
} from '../src/services/admin-market-scope.service';
import { userCanAccessSupportTicket } from '../src/controllers/support.controller';

type MockResponse = {
  statusCode: number;
  body: unknown;
  status: (code: number) => MockResponse;
  json: (body: unknown) => MockResponse;
};

const assertNotProduction = () => {
  const appEnv = String(process.env.APP_ENV || '').toLowerCase();
  const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase();
  if (appEnv === 'production' || nodeEnv === 'production') {
    throw new Error('Refusing to run access-control penetration tests in production mode.');
  }
};

const mockResponse = (): MockResponse => {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return res;
};

const mockRequest = (input: Record<string, unknown> = {}) => ({
  headers: {},
  query: {},
  body: {},
  ...input,
});

const runMiddleware = async (middleware: any, req: any) => {
  const res = mockResponse();
  let nextCalled = false;
  await middleware(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
};

const makeFindByIdQuery = (value: unknown) => ({
  select: () => Promise.resolve(value),
});

const makeFindOneQuery = (value: unknown) => ({
  select: () => ({
    lean: () => Promise.resolve(value),
  }),
});

const signToken = (payload: Record<string, unknown>) => {
  const secret = process.env.JWT_SECRET || 'local-access-control-test-secret';
  return jwt.sign(payload, secret, { expiresIn: '5m' });
};

const withPatchedUser = async (
  patch: Partial<Record<'findById' | 'findOne', unknown>>,
  callback: () => Promise<void>
) => {
  const originalFindById = (User as any).findById;
  const originalFindOne = (User as any).findOne;
  if (patch.findById) (User as any).findById = patch.findById;
  if (patch.findOne) (User as any).findOne = patch.findOne;
  try {
    await callback();
  } finally {
    (User as any).findById = originalFindById;
    (User as any).findOne = originalFindOne;
  }
};

const testAuthenticationMiddleware = async () => {
  let result = await runMiddleware(authenticateToken, mockRequest());
  assert.equal(result.res.statusCode, 401, 'missing token should be rejected');
  assert.equal(result.nextCalled, false, 'missing token should not continue');

  result = await runMiddleware(authenticateToken, mockRequest({ headers: { authorization: 'Basic nope' } }));
  assert.equal(result.res.statusCode, 401, 'malformed auth header should be rejected');

  result = await runMiddleware(authenticateToken, mockRequest({ headers: { authorization: 'Bearer bad-token' } }));
  assert.equal(result.res.statusCode, 403, 'invalid JWT should be rejected');

  await withPatchedUser({
    findById: () => makeFindByIdQuery({ role: UserRole.CUSTOMER, isActive: false, refreshTokenVersion: 0 }),
  }, async () => {
    const token = signToken({ id: '507f1f77bcf86cd799439011', role: UserRole.CUSTOMER, tokenVersion: 0 });
    const inactive = await runMiddleware(authenticateToken, mockRequest({ headers: { authorization: `Bearer ${token}` } }));
    assert.equal(inactive.res.statusCode, 403, 'inactive user token should be rejected');
  });

  await withPatchedUser({
    findById: () => makeFindByIdQuery({ role: UserRole.CUSTOMER, isActive: true, refreshTokenVersion: 2 }),
  }, async () => {
    const token = signToken({ id: '507f1f77bcf86cd799439011', role: UserRole.CUSTOMER, tokenVersion: 1 });
    const stale = await runMiddleware(authenticateToken, mockRequest({ headers: { authorization: `Bearer ${token}` } }));
    assert.equal(stale.res.statusCode, 401, 'stale token version should be rejected');
  });

  await withPatchedUser({
    findById: () => makeFindByIdQuery({ role: UserRole.CUSTOMER, isActive: true, refreshTokenVersion: 3 }),
  }, async () => {
    const token = signToken({ id: '507f1f77bcf86cd799439011', role: UserRole.CUSTOMER, tokenVersion: 3 });
    const valid = await runMiddleware(authenticateToken, mockRequest({ headers: { authorization: `Bearer ${token}` } }));
    assert.equal(valid.nextCalled, true, 'valid current token should continue');
  });
};

const testRoleAndAdminPermissions = async () => {
  let result = await runMiddleware(requireRole([UserRole.ADMIN]), mockRequest({ user: { role: UserRole.CUSTOMER } }));
  assert.equal(result.res.statusCode, 403, 'customer should not enter admin route');

  result = await runMiddleware(requireRole([UserRole.TECHNICIAN]), mockRequest({ user: { role: UserRole.TECHNICIAN } }));
  assert.equal(result.nextCalled, true, 'technician should enter technician route');

  await withPatchedUser({
    findById: () => makeFindByIdQuery({
      role: UserRole.ADMIN,
      adminRole: AdminRole.SUPPORT_AGENT,
      adminPermissions: [],
      isActive: true,
    }),
  }, async () => {
    const denied = await runMiddleware(
      requireAdminPermission(AdminPermission.FINANCE_READ),
      mockRequest({ user: { id: '507f1f77bcf86cd799439011', role: UserRole.ADMIN } })
    );
    assert.equal(denied.res.statusCode, 403, 'support agent should not read finance');
  });

  await withPatchedUser({
    findById: () => makeFindByIdQuery({
      role: UserRole.ADMIN,
      adminRole: AdminRole.SUPER_ADMIN,
      adminPermissions: [],
      isActive: true,
    }),
  }, async () => {
    const allowed = await runMiddleware(
      requireAdminPermission(AdminPermission.ADMINS_UPDATE),
      mockRequest({ user: { id: '507f1f77bcf86cd799439011', role: UserRole.ADMIN } })
    );
    assert.equal(allowed.nextCalled, true, 'super admin should pass admin-management permission');
  });
};

const testMarketScopeIsolation = async () => {
  await withPatchedUser({
    findOne: () => makeFindOneQuery({ role: UserRole.ADMIN, adminRole: AdminRole.SUPER_ADMIN, countryCode: '' }),
  }, async () => {
    const scope = await getAdminMarketScope(mockRequest({ user: { id: '507f1f77bcf86cd799439011' } }) as any);
    assert.equal(scope.canViewAllMarkets, true, 'super admin should view all markets');
    assert.deepEqual(countryScopeFilter(scope), {}, 'super admin country scope should not filter');
  });

  await withPatchedUser({
    findOne: () => makeFindOneQuery({ role: UserRole.ADMIN, adminRole: AdminRole.SUPPORT_AGENT, countryCode: 'ZA' }),
  }, async () => {
    const zaScope = await getAdminMarketScope(mockRequest({
      user: { id: '507f1f77bcf86cd799439011' },
      query: { countryCode: 'ZA' },
    }) as any);
    assert.deepEqual(countryScopeFilter(zaScope), { countryCode: { $in: ['ZA'] } }, 'country staff should be scoped to assigned market');

    await assert.rejects(
      () => getAdminMarketScope(mockRequest({
        user: { id: '507f1f77bcf86cd799439011' },
        query: { countryCode: 'GH' },
      }) as any),
      AdminMarketScopeError,
      'ZA staff should not access GH market data'
    );
  });
};

const testSupportOwnership = () => {
  const customerId = '507f1f77bcf86cd799439011';
  const providerId = '507f1f77bcf86cd799439012';
  assert.equal(userCanAccessSupportTicket({ requesterId: customerId }, customerId, UserRole.CUSTOMER), true);
  assert.equal(userCanAccessSupportTicket({ requesterId: customerId }, providerId, UserRole.TECHNICIAN), false);
  assert.equal(userCanAccessSupportTicket({ requesterId: customerId }, providerId, UserRole.ADMIN), false);
};

const testRouteDefinitions = () => {
  const apiRoutes = fs.readFileSync(path.resolve(__dirname, '../src/routes/api.routes.ts'), 'utf8');
  const adminRoutes = apiRoutes
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
    .filter(({ line }) => /^apiRouter\.(get|post|patch|put|delete)\('\/admin\//.test(line));

  assert(adminRoutes.length > 0, 'expected admin route definitions');
  const unprotectedAdminRoutes = adminRoutes.filter(({ line }) =>
    !line.includes('authenticateToken') ||
    !line.includes('requireRole([UserRole.ADMIN])') ||
    !line.includes('requireAdminPermission(')
  );
  assert.deepEqual(
    unprotectedAdminRoutes,
    [],
    `admin route definitions missing auth/role/permission middleware: ${unprotectedAdminRoutes.map((r) => r.lineNumber).join(', ')}`
  );

  const paymentRoutes = fs.readFileSync(path.resolve(__dirname, '../src/routes/payment.routes.ts'), 'utf8');
  assert(paymentRoutes.includes("router.post('/webhooks/paystack'"), 'Paystack webhook route should exist');
  assert(paymentRoutes.includes('router.use(authenticateToken)'), 'payment routes should protect non-webhook endpoints');
  assert(paymentRoutes.includes('paymentRateLimiter'), 'payment write actions should be rate limited');
};

const run = async () => {
  assertNotProduction();
  await testAuthenticationMiddleware();
  await testRoleAndAdminPermissions();
  await testMarketScopeIsolation();
  testSupportOwnership();
  testRouteDefinitions();
  console.log('Access-control penetration tests passed.');
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
