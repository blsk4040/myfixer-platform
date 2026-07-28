type LoadResult = {
  name: string;
  total: number;
  concurrency: number;
  ok: number;
  failed: number;
  rateLimited: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
};

type Scenario = {
  name: string;
  path: string;
  total: number;
  concurrency: number;
  expectedStatuses: number[];
};

const env = (key: string, fallback = ''): string => String(process.env[key] || fallback).trim();
const numberEnv = (key: string, fallback: number): number => {
  const value = Number.parseInt(env(key), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '');

const assertSafeTarget = (baseUrl: string): void => {
  if (env('LOAD_TEST_ENABLED').toLowerCase() !== 'true') {
    throw new Error('Refusing to run. Set LOAD_TEST_ENABLED=true for an intentional local/staging load test.');
  }

  if (env('APP_ENV').toLowerCase() === 'production' || env('NODE_ENV').toLowerCase() === 'production') {
    throw new Error('Refusing to run load test while APP_ENV/NODE_ENV is production.');
  }

  const url = new URL(baseUrl);
  const hostname = url.hostname.toLowerCase();
  const localhost = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname);
  const knownProductionHosts = new Set(['myfixer-platform.onrender.com']);
  if (knownProductionHosts.has(hostname)) {
    throw new Error(`Refusing to run against known production host: ${hostname}`);
  }

  const explicitlyAllowed = env('LOAD_TEST_ALLOW_HOST').toLowerCase() === hostname;
  const looksStaging = /(^|[-.])(staging|stage|test|qa|dev)([-.]|$)/i.test(hostname);
  if (!localhost && !looksStaging && !explicitlyAllowed) {
    throw new Error(`Refusing ambiguous target ${hostname}. Use localhost/staging or set LOAD_TEST_ALLOW_HOST=${hostname}.`);
  }
};

const percentile = (values: number[], percentage: number): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percentage / 100) * sorted.length) - 1);
  return Math.round(sorted[index]);
};

const runScenario = async (baseUrl: string, scenario: Scenario): Promise<LoadResult> => {
  const timings: number[] = [];
  let ok = 0;
  let failed = 0;
  let rateLimited = 0;
  let next = 0;

  const runOne = async (): Promise<void> => {
    const current = next;
    next += 1;
    if (current >= scenario.total) return;

    const started = performance.now();
    try {
      const response = await fetch(`${baseUrl}${scenario.path}`, {
        headers: { Accept: 'application/json' },
      });
      const elapsed = performance.now() - started;
      timings.push(elapsed);
      if (response.status === 429) rateLimited += 1;
      if (scenario.expectedStatuses.includes(response.status)) ok += 1;
      else failed += 1;
      await response.arrayBuffer().catch(() => undefined);
    } catch {
      timings.push(performance.now() - started);
      failed += 1;
    }

    await runOne();
  };

  await Promise.all(Array.from({ length: scenario.concurrency }, () => runOne()));

  return {
    name: scenario.name,
    total: scenario.total,
    concurrency: scenario.concurrency,
    ok,
    failed,
    rateLimited,
    p50Ms: percentile(timings, 50),
    p95Ms: percentile(timings, 95),
    p99Ms: percentile(timings, 99),
    maxMs: Math.round(Math.max(0, ...timings)),
  };
};

const main = async (): Promise<void> => {
  const baseUrl = normalizeBaseUrl(env('LOAD_TEST_API_BASE_URL', 'http://127.0.0.1:5000/api/v1'));
  assertSafeTarget(baseUrl);

  const total = numberEnv('LOAD_TEST_TOTAL', 120);
  const concurrency = numberEnv('LOAD_TEST_CONCURRENCY', 12);
  const country = encodeURIComponent(env('LOAD_TEST_COUNTRY', 'ZA'));
  const city = encodeURIComponent(env('LOAD_TEST_CITY', 'Johannesburg'));

  const healthBaseUrl = baseUrl.replace(/\/api\/v1$/, '');
  const healthScenario: Scenario = {
    name: 'health',
    path: '/api/health',
    total: Math.min(total, 60),
    concurrency: Math.min(concurrency, 10),
    expectedStatuses: [200],
  };

  const apiScenarios: Scenario[] = [
    {
      name: 'market availability',
      path: `/markets/${country}/availability?city=${city}`,
      total,
      concurrency,
      expectedStatuses: [200, 429],
    },
    {
      name: 'published services',
      path: '/services/published',
      total,
      concurrency,
      expectedStatuses: [200, 429],
    },
  ];

  const results = [
    await runScenario(healthBaseUrl, healthScenario),
    ...(await Promise.all(apiScenarios.map((scenario) => runScenario(baseUrl, scenario)))),
  ];

  console.log('Load readiness target:', baseUrl);
  console.table(results);

  const hardFailures = results.reduce((sum, result) => sum + result.failed, 0);
  const rateLimited = results.reduce((sum, result) => sum + result.rateLimited, 0);
  if (hardFailures > 0) {
    throw new Error(`Load readiness failed with ${hardFailures} unexpected HTTP/network failures.`);
  }
  if (rateLimited > 0) {
    console.warn(`Rate limiting was observed ${rateLimited} times. That is expected when free-tier/local limits are intentionally low.`);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
