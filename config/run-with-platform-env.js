#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
const { loadLocalEnvFile, loadPlatformConfig } = require('./load-platform-config');

loadLocalEnvFile({ override: false });
loadPlatformConfig({ override: false });

const appendNodeOption = (option) => {
  const existing = String(process.env.NODE_OPTIONS || '').trim();
  if (existing.includes(option)) return;
  process.env.NODE_OPTIONS = existing ? `${existing} ${option}` : option;
};

const mongoUri = String(process.env.MONGODB_URI || process.env.MONGO_URI || '');
const shouldBootstrapDns = Boolean(process.env.NODE_DNS_SERVERS) || mongoUri.startsWith('mongodb+srv://');
if (shouldBootstrapDns) {
  const dnsBootstrapPath = path.join(__dirname, 'node-dns-bootstrap.js');
  appendNodeOption(`--require=${dnsBootstrapPath}`);
}

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('Usage: node config/run-with-platform-env.js <command> [...args]');
  process.exit(1);
}

const result = spawnSync(command, args, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

if (result.error) {
  console.error(result.error.message);
}

process.exit(1);
