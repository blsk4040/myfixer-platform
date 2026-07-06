const appJson = require('./app.json');
const { loadPlatformConfig } = require('../../config/load-platform-config');

const { config } = loadPlatformConfig({ override: true });
const isLocalDevelopment = config.APP_ENV === 'development' || process.env.NODE_ENV === 'development';

module.exports = {
  ...appJson.expo,
  ...(isLocalDevelopment ? { updates: { ...(appJson.expo.updates || {}), enabled: false } } : {}),
  extra: {
    ...(appJson.expo.extra || {}),
    API_BASE_URL: config.API_BASE_URL,
    SOCKET_URL: config.SOCKET_URL,
    ADMIN_PORTAL_URL: config.ADMIN_PORTAL_URL,
    APP_ENV: config.APP_ENV,
  },
};
