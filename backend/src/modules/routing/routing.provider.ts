import { OsrmRoutingProvider } from './osrm.provider';
import { RoutingError, RoutingProvider, RoutingProviderName } from './routing.types';

export const getRoutingProviderName = (): RoutingProviderName => {
  const configured = (process.env.ROUTING_PROVIDER || 'osrm').trim().toLowerCase();
  if (configured === 'osrm') return 'osrm';
  throw new RoutingError('ROUTING_PROVIDER_UNAVAILABLE', 'Routing provider is not configured.', 503);
};

export const createRoutingProvider = (): RoutingProvider => {
  const providerName = getRoutingProviderName();
  if (providerName === 'osrm') return new OsrmRoutingProvider();
  throw new RoutingError('ROUTING_PROVIDER_UNAVAILABLE', 'Routing provider is not available.', 503);
};
