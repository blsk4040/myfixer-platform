# Redis Usage

Redis is optional for MyFixer.

The main cloud database is MongoDB Atlas. Redis is currently used only as a fast geospatial store for live technician location discovery:

- Technician socket events write latest coordinates to Redis.
- Booking matching queries Redis for nearby technician IDs.

## Default Local Development

Redis is disabled by default. The backend should boot normally without Redis.

```env
REDIS_ENABLED=false
REDIS_URL=redis://localhost:6379
```

When Redis is disabled, local matching falls back to development technician IDs outside production. In production, matching returns no Redis-backed technician IDs unless Redis is explicitly configured.

## Enable Redis

Only enable Redis when using Redis-backed queues, caching, rate limiting, Socket.IO scaling, or live technician geolocation matching.

```env
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
```

If Redis is enabled but unavailable, the backend logs one clean warning and continues without retry spam.
