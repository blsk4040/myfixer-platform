import { MarketStatus } from '../models/market-setting.model';

export type MarketCityAvailability = {
  city: string;
  status?: MarketStatus | string;
  services?: unknown[];
  areas?: MarketAreaAvailability[];
  [key: string]: unknown;
};

export type MarketAreaAvailability = {
  name: string;
  status?: MarketStatus | string;
  services?: unknown[];
  [key: string]: unknown;
};

export type MarketCoverageShape = {
  supportedCities?: string[];
  cityServiceAvailability?: MarketCityAvailability[];
  [key: string]: unknown;
};

export const normalizeMarketCityName = (value: unknown): string =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

export const marketCityKey = (value: unknown): string =>
  normalizeMarketCityName(value).toLocaleLowerCase();

export const normalizeMarketAreaName = normalizeMarketCityName;

export const marketAreaKey = marketCityKey;

export const cityNamesFromCoverage = (coverage: MarketCoverageShape = {}): string[] => {
  const byKey = new Map<string, string>();
  (coverage.supportedCities || []).forEach((city) => {
    const normalized = normalizeMarketCityName(city);
    if (normalized) byKey.set(marketCityKey(normalized), normalized);
  });
  (coverage.cityServiceAvailability || []).forEach((row) => {
    const normalized = normalizeMarketCityName(row?.city);
    if (normalized && !byKey.has(marketCityKey(normalized))) byKey.set(marketCityKey(normalized), normalized);
  });
  return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
};

export const cityExistsInCoverage = (coverage: MarketCoverageShape = {}, cityName: string): boolean =>
  cityNamesFromCoverage(coverage).some((city) => marketCityKey(city) === marketCityKey(cityName));

export const addCityToCoverage = (coverage: MarketCoverageShape = {}, cityName: string): MarketCoverageShape => {
  const normalized = normalizeMarketCityName(cityName);
  if (!normalized) throw new Error('City name is required.');
  if (cityExistsInCoverage(coverage, normalized)) throw new Error('A city with this name already exists in this country.');

  return {
    ...coverage,
    supportedCities: [...(coverage.supportedCities || []), normalized],
    cityServiceAvailability: [
      ...(coverage.cityServiceAvailability || []),
      { city: normalized, status: MarketStatus.ACTIVE, services: [], areas: [] },
    ],
  };
};

export const renameCityInCoverage = (coverage: MarketCoverageShape = {}, currentCity: string, nextCity: string): MarketCoverageShape => {
  const current = normalizeMarketCityName(currentCity);
  const next = normalizeMarketCityName(nextCity);
  if (!current || !next) throw new Error('City name is required.');
  if (marketCityKey(current) !== marketCityKey(next) && cityExistsInCoverage(coverage, next)) {
    throw new Error('A city with this name already exists in this country.');
  }

  return {
    ...coverage,
    supportedCities: (coverage.supportedCities || []).map((city) => marketCityKey(city) === marketCityKey(current) ? next : city),
    cityServiceAvailability: (coverage.cityServiceAvailability || []).map((row) =>
      marketCityKey(row.city) === marketCityKey(current) ? { ...row, city: next } : row
    ),
  };
};

export const cityHasEmbeddedOperationalConfiguration = (coverage: MarketCoverageShape = {}, cityName: string): boolean => {
  const key = marketCityKey(cityName);
  const row = (coverage.cityServiceAvailability || []).find((item) => marketCityKey(item.city) === key);
  if (!row) return false;
  return Boolean((row.services || []).length || (row.areas || []).length);
};

export const removeCityFromCoverage = (coverage: MarketCoverageShape = {}, cityName: string): MarketCoverageShape => {
  const normalized = normalizeMarketCityName(cityName);
  if (!normalized) throw new Error('City name is required.');
  return {
    ...coverage,
    supportedCities: (coverage.supportedCities || []).filter((city) => marketCityKey(city) !== marketCityKey(normalized)),
    cityServiceAvailability: (coverage.cityServiceAvailability || []).filter((row) => marketCityKey(row.city) !== marketCityKey(normalized)),
  };
};

export const findCityInCoverage = (coverage: MarketCoverageShape = {}, cityName: string): MarketCityAvailability | undefined => {
  const key = marketCityKey(cityName);
  return (coverage.cityServiceAvailability || []).find((row) => marketCityKey(row.city) === key);
};

const ensureCityRow = (coverage: MarketCoverageShape = {}, cityName: string): MarketCityAvailability => {
  const normalizedCity = normalizeMarketCityName(cityName);
  const existing = findCityInCoverage(coverage, normalizedCity);
  if (existing) return existing;
  if (!cityExistsInCoverage(coverage, normalizedCity)) throw new Error('City not found in this country.');
  return { city: normalizedCity, status: MarketStatus.ACTIVE, services: [], areas: [] };
};

export const areaNamesFromCity = (coverage: MarketCoverageShape = {}, cityName: string): string[] => {
  const row = findCityInCoverage(coverage, cityName);
  return (row?.areas || [])
    .map((area) => normalizeMarketAreaName(area?.name))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
};

export const areaExistsInCity = (coverage: MarketCoverageShape = {}, cityName: string, areaName: string): boolean =>
  areaNamesFromCity(coverage, cityName).some((area) => marketAreaKey(area) === marketAreaKey(areaName));

const updateCityRow = (
  coverage: MarketCoverageShape = {},
  cityName: string,
  update: (row: MarketCityAvailability) => MarketCityAvailability
): MarketCoverageShape => {
  const normalizedCity = normalizeMarketCityName(cityName);
  const row = ensureCityRow(coverage, normalizedCity);
  const rows = coverage.cityServiceAvailability || [];
  const hasRow = rows.some((item) => marketCityKey(item.city) === marketCityKey(normalizedCity));
  const nextRows = hasRow
    ? rows.map((item) => marketCityKey(item.city) === marketCityKey(normalizedCity) ? update(item) : item)
    : [...rows, update(row)];
  return { ...coverage, cityServiceAvailability: nextRows };
};

export const addAreaToCity = (coverage: MarketCoverageShape = {}, cityName: string, areaName: string): MarketCoverageShape => {
  const normalizedArea = normalizeMarketAreaName(areaName);
  if (!normalizedArea) throw new Error('Area name is required.');
  if (areaExistsInCity(coverage, cityName, normalizedArea)) throw new Error('An area with this name already exists in this city.');
  return updateCityRow(coverage, cityName, (row) => ({
    ...row,
    areas: [...(row.areas || []), { name: normalizedArea, status: MarketStatus.ACTIVE, services: [] }],
  }));
};

export const renameAreaInCity = (coverage: MarketCoverageShape = {}, cityName: string, currentArea: string, nextArea: string): MarketCoverageShape => {
  const current = normalizeMarketAreaName(currentArea);
  const next = normalizeMarketAreaName(nextArea);
  if (!current || !next) throw new Error('Area name is required.');
  if (marketAreaKey(current) !== marketAreaKey(next) && areaExistsInCity(coverage, cityName, next)) {
    throw new Error('An area with this name already exists in this city.');
  }
  return updateCityRow(coverage, cityName, (row) => ({
    ...row,
    areas: (row.areas || []).map((area) => marketAreaKey(area.name) === marketAreaKey(current) ? { ...area, name: next } : area),
  }));
};

export const areaHasEmbeddedOperationalConfiguration = (coverage: MarketCoverageShape = {}, cityName: string, areaName: string): boolean => {
  const row = findCityInCoverage(coverage, cityName);
  const area = (row?.areas || []).find((item) => marketAreaKey(item.name) === marketAreaKey(areaName));
  return Boolean(area && (area.services || []).length);
};

export const removeAreaFromCity = (coverage: MarketCoverageShape = {}, cityName: string, areaName: string): MarketCoverageShape => {
  const normalizedArea = normalizeMarketAreaName(areaName);
  if (!normalizedArea) throw new Error('Area name is required.');
  return updateCityRow(coverage, cityName, (row) => ({
    ...row,
    areas: (row.areas || []).filter((area) => marketAreaKey(area.name) !== marketAreaKey(normalizedArea)),
  }));
};
