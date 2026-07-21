const dns = require('dns');

const defaultServers = '8.8.8.8,1.1.1.1';
const configuredServers = String(process.env.NODE_DNS_SERVERS || defaultServers)
  .split(',')
  .map((server) => server.trim())
  .filter(Boolean);

if (configuredServers.length) {
  dns.setDefaultResultOrder?.('ipv4first');
  dns.setServers(configuredServers);
  dns.promises?.setServers(configuredServers);
}
