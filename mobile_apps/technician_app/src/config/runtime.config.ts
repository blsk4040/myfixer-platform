declare const process: {
  env?: {
    EXPO_PUBLIC_API_BASE_URL?: string;
    EXPO_PUBLIC_API_URL?: string;
    EXPO_PUBLIC_SOCKET_URL?: string;
    EXPO_PUBLIC_SOCKET_DEBUG?: string;
    EXPO_PUBLIC_EAS_PROJECT_ID?: string;
    EXPO_PUBLIC_APP_ENV?: string;
    NODE_ENV?: string;
  };
};

type ExpoConstantsLike = {
  easConfig?: {
    projectId?: string;
  };
  expoConfig?: {
    extra?: {
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

function getEnvValue(key: keyof NonNullable<typeof process.env>): string {
  const value = process.env?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function isProductionBuild(): boolean {
  return getEnvValue('NODE_ENV') === 'production' || getEnvValue('EXPO_PUBLIC_APP_ENV') === 'production';
}

export function isSocketDebugEnabled(): boolean {
  return !isProductionBuild() || getEnvValue('EXPO_PUBLIC_SOCKET_DEBUG') === 'true';
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
  const configuredUrl = getEnvValue('EXPO_PUBLIC_API_BASE_URL') || getEnvValue('EXPO_PUBLIC_API_URL');
  const requiredUrl = requireExpoUrl(configuredUrl, 'EXPO_PUBLIC_API_BASE_URL');
  return requiredUrl ? normalizeApiBaseUrl(requiredUrl) : '';
}

export function getSocketUrl(): string {
  const configuredSocketUrl = getEnvValue('EXPO_PUBLIC_SOCKET_URL');
  if (configuredSocketUrl) return normalizeUrl(configuredSocketUrl);

  const apiBaseUrl = getApiBaseUrl();
  return apiBaseUrl ? normalizeUrl(apiBaseUrl.replace(/\/api\/v1$/, '')) : '';
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

