#!/usr/bin/env node
const { spawnSync } = require('child_process');
const { loadPlatformConfig } = require('./load-platform-config');

loadPlatformConfig({ override: true });

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
