import authService from './auth.service';
import { assertConfiguredUrl, getApiBaseUrl } from '../config/runtime.config';
import { RouteRequest, RouteResult } from '../types/routing';

const API_BASE_URL = getApiBaseUrl();

interface RouteApiResponse {
  success: boolean;
  data: RouteResult;
}

export async function calculateRoute(payload: RouteRequest, signal?: AbortSignal): Promise<RouteResult> {
  assertConfiguredUrl(API_BASE_URL, 'EXPO_PUBLIC_API_BASE_URL');

  const response = await fetch(`${API_BASE_URL}/routing/route`, {
    method: 'POST',
    signal,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...authService.getAuthHeader(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = 'The road route is temporarily unavailable.';
    try {
      const body = (await response.json()) as { message?: unknown };
      if (typeof body.message === 'string' && body.message.trim()) message = body.message;
    } catch {
      // Keep the safe user-facing fallback.
    }
    throw new Error(message);
  }

  const body = (await response.json()) as RouteApiResponse;
  return body.data;
}
