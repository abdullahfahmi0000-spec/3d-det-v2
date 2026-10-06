import { type HealthResponse, HealthResponseSchema } from '@3ddet/contracts';

/**
 * Base path for API calls. In development Vite proxies `/api` to the local API; in deployed
 * environments it is served from the same origin.
 */
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

/**
 * Fetches the API health endpoint and validates the response against the shared contract,
 * so a server-side change that breaks the contract fails here rather than downstream.
 */
export async function fetchHealth(fetchImpl: typeof fetch = fetch): Promise<HealthResponse> {
  const response = await fetchImpl(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error(`health check failed with HTTP ${response.status}`);
  }
  return HealthResponseSchema.parse(await response.json());
}
