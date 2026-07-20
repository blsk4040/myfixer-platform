const fs = require('fs');
const path = require('path');

const SHARED_KEYS = [
  'API_BASE_URL',
  'SOCKET_URL',
  'ADMIN_PORTAL_URL',
  'APP_ENV',
];

const EXPO_PUBLIC_KEY_MAP = {
  API_BASE_URL: 'EXPO_PUBLIC_API_BASE_URL',
  SOCKET_URL: 'EXPO_PUBLIC_SOCKET_URL',
  APP_ENV: 'EXPO_PUBLIC_APP_ENV',
};

const normalizeEnvironmentName = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'prod') return 'production';
  if (normalized === 'stage') return 'staging';
  if (normalized === 'dev') return 'development';
  if (['development', 'staging', 'production'].includes(normalized)) return normalized;
  return '';
};

const resolvePlatformEnv = (explicitEnv) => {
  const selected =
    normalizeEnvironmentName(explicitEnv) ||
    normalizeEnvironmentName(process.env.MYFIXER_ENV) ||
    normalizeEnvironmentName(process.env.APP_ENV) ||
    normalizeEnvironmentName(process.env.NODE_ENV);

  return selected || 'development';
};

const parseEnvFile = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const values = {};

  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) return;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  });

  return values;
};

const loadLocalEnvFile = (options = {}) => {
  const filePath = options.filePath || path.join(process.cwd(), '.env');
  const override = options.override === true;

  if (!fs.existsSync(filePath)) {
    return { filePath, loaded: false, config: {} };
  }

  const parsed = parseEnvFile(filePath);
  Object.entries(parsed).forEach(([key, value]) => {
    if (override || !process.env[key]) {
      process.env[key] = value;
    }
  });

  return { filePath, loaded: true, config: parsed };
};

const loadPlatformConfig = (options = {}) => {
  const platformEnv = resolvePlatformEnv(options.env);
  const configDir = options.configDir || __dirname;
  const filePath = path.join(configDir, `${platformEnv}.env`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing shared platform config: ${filePath}`);
  }

  const parsed = parseEnvFile(filePath);
  const config = {};
  const override = options.override === true;

  SHARED_KEYS.forEach((key) => {
    const value = parsed[key];
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Missing ${key} in ${filePath}`);
    }

    const resolvedValue = override || !process.env[key]
      ? value.trim()
      : process.env[key].trim();

    config[key] = resolvedValue;
    if (override || !process.env[key]) {
      process.env[key] = resolvedValue;
    }

    const expoKey = EXPO_PUBLIC_KEY_MAP[key];
    if (expoKey && (override || !process.env[expoKey])) {
      process.env[expoKey] = resolvedValue;
    }
  });

  return { env: platformEnv, filePath, config };
};

module.exports = {
  EXPO_PUBLIC_KEY_MAP,
  SHARED_KEYS,
  loadLocalEnvFile,
  loadPlatformConfig,
  resolvePlatformEnv,
};
