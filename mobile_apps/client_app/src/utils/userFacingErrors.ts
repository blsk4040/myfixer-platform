const authErrorPatterns = [
  'no token provided',
  'token is required',
  'unauthorized',
  'session has expired',
  'invalid token',
];

export const isAuthSessionError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || '');
  const normalized = message.trim().toLowerCase();
  return authErrorPatterns.some((pattern) => normalized.includes(pattern));
};

export const customerErrorMessage = (
  error: unknown,
  fallback: string,
  authMessage = 'Please sign in again to continue.'
): string => {
  if (isAuthSessionError(error)) return authMessage;
  return error instanceof Error && error.message.trim() ? error.message : fallback;
};
