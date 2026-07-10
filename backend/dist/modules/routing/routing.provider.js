"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRoutingProvider = exports.getRoutingProviderName = void 0;
const osrm_provider_1 = require("./osrm.provider");
const routing_types_1 = require("./routing.types");
const getRoutingProviderName = () => {
    const configured = (process.env.ROUTING_PROVIDER || 'osrm').trim().toLowerCase();
    if (configured === 'osrm')
        return 'osrm';
    throw new routing_types_1.RoutingError('ROUTING_PROVIDER_UNAVAILABLE', 'Routing provider is not configured.', 503);
};
exports.getRoutingProviderName = getRoutingProviderName;
const createRoutingProvider = () => {
    const providerName = (0, exports.getRoutingProviderName)();
    if (providerName === 'osrm')
        return new osrm_provider_1.OsrmRoutingProvider();
    throw new routing_types_1.RoutingError('ROUTING_PROVIDER_UNAVAILABLE', 'Routing provider is not available.', 503);
};
exports.createRoutingProvider = createRoutingProvider;
//# sourceMappingURL=routing.provider.js.map