# MyFixer Environment Setup

MyFixer uses one GitHub codebase for local, staging, and production. Do not edit source code when switching environments. Change environment variables only.

## Backend

Local:

```powershell
cd C:\myfixer-platform\backend
Copy-Item .env.local.example .env
npm run dev
```

Production:

- Do not copy `.env` into GitHub.
- Configure the values from `backend/.env.production.example` in the live server secret manager.
- Start from the same GitHub code:

```powershell
npm install
npm run build
npm start
```

## Admin Portal

The admin portal server exposes `/config.js` from environment variables.

Local:

```powershell
cd C:\myfixer-platform\admin_portal
$env:ADMIN_API_BASE_URL='http://localhost:5000/api/v1'
npm start
```

Production:

```powershell
$env:ADMIN_API_BASE_URL='https://api.hellopadi.com/api/v1'
npm start
```

The browser can still override the URL from the login screen connection settings, but production hosting should set `ADMIN_API_BASE_URL`.

## Customer App

Local physical phone testing:

```powershell
cd C:\myfixer-platform\mobile_apps\client_app
$env:EXPO_PUBLIC_API_BASE_URL='http://192.168.3.34:5000/api/v1'
$env:EXPO_PUBLIC_SOCKET_URL='http://192.168.3.34:5000'
$env:EXPO_PUBLIC_APP_ENV='development'
npm run start
```

Production build:

```powershell
$env:EXPO_PUBLIC_API_BASE_URL='https://api.hellopadi.com/api/v1'
$env:EXPO_PUBLIC_SOCKET_URL='https://api.hellopadi.com'
$env:EXPO_PUBLIC_APP_ENV='production'
```

## Technician App

Local physical phone testing:

```powershell
cd C:\myfixer-platform\mobile_apps\technician_app
$env:EXPO_PUBLIC_API_BASE_URL='http://192.168.3.34:5000/api/v1'
$env:EXPO_PUBLIC_SOCKET_URL='http://192.168.3.34:5000'
$env:EXPO_PUBLIC_APP_ENV='development'
npm run start
```

Production build:

```powershell
$env:EXPO_PUBLIC_API_BASE_URL='https://api.hellopadi.com/api/v1'
$env:EXPO_PUBLIC_SOCKET_URL='https://api.hellopadi.com'
$env:EXPO_PUBLIC_APP_ENV='production'
```

## Rule

Local URLs, live URLs, database strings, JWT secrets, API keys, and payment keys belong in environment variables only. The code should be deployable from GitHub without source edits.
