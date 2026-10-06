/**
 * Runtime configuration, read once from the environment at start-up.
 *
 * Values are validated here so a misconfigured deployment fails at boot rather than on the
 * first request. Secrets are never defaulted; see docs/SECURITY.md.
 */
export interface ApiConfig {
  readonly port: number;
  readonly corsOrigin: string;
}

export function loadConfig(env: NodeJS.ProcessEnv): ApiConfig {
  const port = Number.parseInt(env.API_PORT ?? '3000', 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`API_PORT must be a valid TCP port, received "${env.API_PORT ?? ''}"`);
  }
  return {
    port,
    corsOrigin: env.API_CORS_ORIGIN ?? 'http://localhost:5173',
  };
}
