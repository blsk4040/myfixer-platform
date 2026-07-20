"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.httpServer = exports.app = void 0;
// src/server.ts
const dns_1 = __importDefault(require("dns"));
const dns_2 = require("dns");
dns_1.default.setDefaultResultOrder('ipv4first');
dns_1.default.setServers(['8.8.8.8', '1.1.1.1']);
dns_2.promises.setServers(['8.8.8.8', '1.1.1.1']);
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env') });
require('../../config/load-platform-config').loadPlatformConfig({ override: false });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const mongoose_1 = __importDefault(require("mongoose"));
const socket_io_1 = require("socket.io");
const api_routes_1 = __importDefault(require("./routes/api.routes"));
const socket_server_1 = require("./sockets/socket.server");
const paystack_service_1 = require("./services/paystack.service");
const payment_capabilities_config_1 = require("./config/payment-capabilities.config");
const validateStartupConfiguration = () => {
    const routingProvider = (process.env.ROUTING_PROVIDER || 'osrm').trim().toLowerCase();
    const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
    if (isProduction && routingProvider === 'osrm' && !process.env.OSRM_BASE_URL?.trim()) {
        throw new Error('OSRM_BASE_URL must be configured when ROUTING_PROVIDER=osrm in production.');
    }
    if (process.env.NODE_ENV === 'production' || (process.env.PAYSTACK_ENABLED || '').trim().toLowerCase() === 'true') {
        (0, paystack_service_1.validatePaystackStartupConfiguration)();
    }
    (0, payment_capabilities_config_1.validatePayoutStartupConfiguration)();
};
validateStartupConfiguration();
const parseAllowedOrigins = () => {
    const configuredOrigins = process.env.CORS_ORIGIN ?? process.env.CORS_ORIGINS;
    if (!configuredOrigins) {
        return [process.env.ADMIN_PORTAL_URL].filter((origin) => Boolean(origin));
    }
    return configuredOrigins.split(',').map((o) => o.trim()).filter(Boolean);
};
const allowedOrigins = parseAllowedOrigins();
const corsOptions = {
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
};
exports.app = (0, express_1.default)();
exports.httpServer = http_1.default.createServer(exports.app);
exports.io = new socket_io_1.Server(exports.httpServer, {
    cors: { origin: allowedOrigins, credentials: true, methods: ['GET', 'POST'] },
});
exports.app.use((0, helmet_1.default)());
exports.app.use((0, cors_1.default)(corsOptions));
const jsonBodyLimit = process.env.JSON_BODY_LIMIT || '8mb';
exports.app.use(express_1.default.json({
    limit: jsonBodyLimit,
    verify: (req, _res, buf) => {
        req.rawBody = Buffer.from(buf);
    },
}));
exports.app.use(express_1.default.urlencoded({ extended: true, limit: jsonBodyLimit }));
exports.app.use((0, morgan_1.default)(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
exports.app.set('io', exports.io);
// Versioned umbrella endpoints
exports.app.use('/api/v1', api_routes_1.default);
exports.app.get('/api/health', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'myfixer-backend',
        timestamp: new Date().toISOString(),
    });
});
(0, socket_server_1.registerSocketServer)(exports.io);
const port = Number.parseInt(process.env.PORT ?? '5000', 10);
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
    console.error('❌ MONGODB_URI is not defined in environment variables!');
    process.exit(1);
}
mongoose_1.default.set('strictQuery', true);
let isShuttingDown = false;
const shutdown = async (signal) => {
    if (isShuttingDown)
        return;
    isShuttingDown = true;
    console.info(`${signal} received. Shutting down MyFixer backend...`);
    exports.httpServer.close(async () => {
        try {
            await mongoose_1.default.disconnect();
            console.info('HTTP server closed and MongoDB disconnected.');
            process.exit(0);
        }
        catch (error) {
            console.error('Error while disconnecting MongoDB:', error);
            process.exit(1);
        }
    });
    setTimeout(() => {
        console.error('Forced shutdown after timeout.');
        process.exit(1);
    }, 5000);
};
const startServer = async () => {
    try {
        await mongoose_1.default.connect(mongoUri, {
            serverSelectionTimeoutMS: 10000,
            autoIndex: true,
        });
        console.info('💾 MongoDB Atlas connected successfully');
        exports.httpServer.listen(port, '0.0.0.0', () => {
            console.info(`🚀 MyFixer backend running on port ${port}`);
        });
    }
    catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        process.exit(1);
    }
};
process.on('SIGINT', () => {
    void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
});
if (require.main === module) {
    void startServer();
}
//# sourceMappingURL=server.js.map