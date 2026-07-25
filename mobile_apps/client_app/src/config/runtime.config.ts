import Constants from 'expo-constants';

declare const process: {
  env?: {
    EXPO_PUBLIC_API_BASE_URL?: string;
    EXPO_PUBLIC_API_URL?: string;
    EXPO_PUBLIC_SOCKET_URL?: string;
    EXPO_PUBLIC_APP_ENV?: string;
    EXPO_PUBLIC_EAS_PROJECT_ID?: string;
    EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?: string;
    EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?: string;
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?: string;
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?: string;
    EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?: string;
    EXPO_PUBLIC_GEOAPIFY_API_KEY?: string;
    NODE_ENV?: string;
  };
};

type ExpoConstantsLike = {
  easConfig?: {
    projectId?: string;
  };
  expoConfig?: {
    extra?: {
      API_BASE_URL?: string;
      SOCKET_URL?: string;
      APP_ENV?: string;
      GEOAPIFY_API_KEY?: string;
      eas?: {
        projectId?: string;
      };
      EAS_PROJECT_ID?: string;
    };
  };
  manifest2?: {
    extra?: {
      expoClient?: {
        extra?: {
          API_BASE_URL?: string;
          SOCKET_URL?: string;
          APP_ENV?: string;
          GEOAPIFY_API_KEY?: string;
          eas?: {
            projectId?: string;
          };
          EAS_PROJECT_ID?: string;
        };
      };
    };
  };
};

const warnedKeys = new Set<string>();

const EXPO_ENV = {
  EXPO_PUBLIC_API_BASE_URL: process.env?.EXPO_PUBLIC_API_BASE_URL,
  EXPO_PUBLIC_API_URL: process.env?.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_SOCKET_URL: process.env?.EXPO_PUBLIC_SOCKET_URL,
  EXPO_PUBLIC_APP_ENV: process.env?.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_EAS_PROJECT_ID: process.env?.EXPO_PUBLIC_EAS_PROJECT_ID,
  EXPO_PUBLIC_GEOAPIFY_API_KEY: process.env?.EXPO_PUBLIC_GEOAPIFY_API_KEY,
};

function getEnvValue(key: keyof NonNullable<typeof process.env>): string {
  const value = EXPO_ENV[key as keyof typeof EXPO_ENV];
  return typeof value === 'string' ? value.trim() : '';
}

function getExpoExtraValue(key: 'API_BASE_URL' | 'SOCKET_URL' | 'APP_ENV' | 'GEOAPIFY_API_KEY'): string {
  const constants = Constants as ExpoConstantsLike;
  const value =
    constants.expoConfig?.extra?.[key] ||
    constants.manifest2?.extra?.expoClient?.extra?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function isProductionBuild(): boolean {
  return (
    getEnvValue('NODE_ENV') === 'production' ||
    getEnvValue('EXPO_PUBLIC_APP_ENV') === 'production' ||
    getExpoExtraValue('APP_ENV') === 'production'
  );
}

function warnOnce(key: string, message: string): void {
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  if (!isProductionBuild()) console.warn(message);
}

function requireExpoUrl(value: string, envName: string): string {
  if (value) return value;

  const message = `${envName} is required. Configure Expo public environment variables before running the app.`;
  if (isProductionBuild()) throw new Error(message);

  warnOnce(envName, message);
  return '';
}

function normalizeUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeApiBaseUrl(value: string): string {
  const normalized = normalizeUrl(value);
  return normalized.endsWith('/api/v1') ? normalized : `${normalized}/api/v1`;
}

export function getApiBaseUrl(): string {
  const configuredUrl =
    getEnvValue('EXPO_PUBLIC_API_BASE_URL') ||
    getEnvValue('EXPO_PUBLIC_API_URL') ||
    getExpoExtraValue('API_BASE_URL');
  const requiredUrl = requireExpoUrl(configuredUrl, 'EXPO_PUBLIC_API_BASE_URL');
  return requiredUrl ? normalizeApiBaseUrl(requiredUrl) : '';
}

export function getSocketUrl(): string {
  const configuredSocketUrl = getEnvValue('EXPO_PUBLIC_SOCKET_URL') || getExpoExtraValue('SOCKET_URL');
  if (configuredSocketUrl) return normalizeUrl(configuredSocketUrl);

  const apiBaseUrl = getApiBaseUrl();
  return apiBaseUrl ? normalizeUrl(apiBaseUrl.replace(/\/api\/v1$/, '')) : '';
}

export function getGeoapifyApiKey(): string {
  return getEnvValue('EXPO_PUBLIC_GEOAPIFY_API_KEY') || getExpoExtraValue('GEOAPIFY_API_KEY');
}

export function getExpoProjectId(constants?: ExpoConstantsLike): string {
  return (
    getEnvValue('EXPO_PUBLIC_EAS_PROJECT_ID') ||
    constants?.easConfig?.projectId ||
    constants?.expoConfig?.extra?.eas?.projectId ||
    constants?.expoConfig?.extra?.EAS_PROJECT_ID ||
    constants?.manifest2?.extra?.expoClient?.extra?.eas?.projectId ||
    constants?.manifest2?.extra?.expoClient?.extra?.EAS_PROJECT_ID ||
    ''
  ).trim();
}

export function assertConfiguredUrl(value: string, envName: string): void {
  if (value) return;
  throw new Error(`${envName} is not configured. Set Expo public environment variables for this build.`);
}
