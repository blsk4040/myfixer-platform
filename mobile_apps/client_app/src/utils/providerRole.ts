type ProviderRole = {
  singular: string;
  capitalized: string;
};

const normalizeServiceKey = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export const getProviderRoleForService = (serviceKey: unknown, serviceName?: unknown): ProviderRole => {
  const normalized = normalizeServiceKey(serviceKey || serviceName);
  const label = String(serviceName || '').toLowerCase();
  const source = `${normalized} ${label}`;

  let singular = 'provider';
  if (source.includes('clean')) singular = 'cleaner';
  else if (source.includes('plumb')) singular = 'plumber';
  else if (source.includes('electric')) singular = 'electrician';
  else if (source.includes('garden')) singular = 'gardener';
  else if (source.includes('paint')) singular = 'painter';
  else if (source.includes('auto') || source.includes('mechanic') || source.includes('vehicle') || source.includes('car')) singular = 'mechanic';
  else if (source.includes('appliance') || source.includes('repair') || source.includes('maintenance')) singular = 'technician';

  return {
    singular,
    capitalized: singular.charAt(0).toUpperCase() + singular.slice(1),
  };
};
