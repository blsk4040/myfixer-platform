# MyFixer Mobile Environment Setup

Both Expo mobile apps must receive backend URLs from Expo public environment variables. The apps no longer ship local or LAN fallback URLs.

## Required Variables

- `EXPO_PUBLIC_API_BASE_URL`: Backend API URL, including `/api/v1` or the backend origin. If the origin is provided, the app appends `/api/v1`.
- `EXPO_PUBLIC_SOCKET_URL`: Socket.IO backend origin. If omitted, the app derives it from `EXPO_PUBLIC_API_BASE_URL`.
- `EXPO_PUBLIC_APP_ENV`: Set to `production` for release builds.

`EXPO_PUBLIC_API_URL` is still accepted as a temporary legacy alias for existing local scripts, but new setup should use `EXPO_PUBLIC_API_BASE_URL`.

## Local Development

Start the backend, then set the Expo variables to the reachable backend URL for the device or emulator you are using. Do not commit local machine URLs to source.

Customer app:

```powershell
cd C:\myfixer-platform\mobile_apps\client_app
$env:EXPO_PUBLIC_API_BASE_URL='<reachable-backend-api-url>'
$env:EXPO_PUBLIC_SOCKET_URL='<reachable-backend-socket-url>'
npm run start
```

Technician app:

```powershell
cd C:\myfixer-platform\mobile_apps\technician_app
$env:EXPO_PUBLIC_API_BASE_URL='<reachable-backend-api-url>'
$env:EXPO_PUBLIC_SOCKET_URL='<reachable-backend-socket-url>'
npm run start
```

## Production Builds

Set production URLs through the release environment:

```powershell
$env:EXPO_PUBLIC_API_BASE_URL='https://api.hellopadi.com/api/v1'
$env:EXPO_PUBLIC_SOCKET_URL='https://api.hellopadi.com'
$env:EXPO_PUBLIC_APP_ENV='production'
```

When `EXPO_PUBLIC_APP_ENV=production`, missing URLs fail clearly instead of falling back to development hosts.
