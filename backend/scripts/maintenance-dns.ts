import dns from 'dns';

export const configureMaintenanceDnsFromEnv = (): string[] => {
  const servers = String(process.env.NODE_DNS_SERVERS || '')
    .split(',')
    .map((server) => server.trim())
    .filter(Boolean);

  if (!servers.length) return [];

  try {
    dns.setServers(servers);
    dns.promises.setServers(servers);
    return servers;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DNS configuration error.';
    throw new Error(`Invalid NODE_DNS_SERVERS value: ${message}`);
  }
};
