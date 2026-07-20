"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeAreaFromCity = exports.areaHasEmbeddedOperationalConfiguration = exports.renameAreaInCity = exports.addAreaToCity = exports.areaExistsInCity = exports.areaNamesFromCity = exports.findCityInCoverage = exports.removeCityFromCoverage = exports.cityHasEmbeddedOperationalConfiguration = exports.renameCityInCoverage = exports.addCityToCoverage = exports.cityExistsInCoverage = exports.cityNamesFromCoverage = exports.marketAreaKey = exports.normalizeMarketAreaName = exports.marketCityKey = exports.normalizeMarketCityName = void 0;
const market_setting_model_1 = require("../models/market-setting.model");
const normalizeMarketCityName = (value) => String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
exports.normalizeMarketCityName = normalizeMarketCityName;
const marketCityKey = (value) => (0, exports.normalizeMarketCityName)(value).toLocaleLowerCase();
exports.marketCityKey = marketCityKey;
exports.normalizeMarketAreaName = exports.normalizeMarketCityName;
exports.marketAreaKey = exports.marketCityKey;
const cityNamesFromCoverage = (coverage = {}) => {
    const byKey = new Map();
    (coverage.supportedCities || []).forEach((city) => {
        const normalized = (0, exports.normalizeMarketCityName)(city);
        if (normalized)
            byKey.set((0, exports.marketCityKey)(normalized), normalized);
    });
    (coverage.cityServiceAvailability || []).forEach((row) => {
        const normalized = (0, exports.normalizeMarketCityName)(row?.city);
        if (normalized && !byKey.has((0, exports.marketCityKey)(normalized)))
            byKey.set((0, exports.marketCityKey)(normalized), normalized);
    });
    return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
};
exports.cityNamesFromCoverage = cityNamesFromCoverage;
const cityExistsInCoverage = (coverage = {}, cityName) => (0, exports.cityNamesFromCoverage)(coverage).some((city) => (0, exports.marketCityKey)(city) === (0, exports.marketCityKey)(cityName));
exports.cityExistsInCoverage = cityExistsInCoverage;
const addCityToCoverage = (coverage = {}, cityName) => {
    const normalized = (0, exports.normalizeMarketCityName)(cityName);
    if (!normalized)
        throw new Error('City name is required.');
    if ((0, exports.cityExistsInCoverage)(coverage, normalized))
        throw new Error('A city with this name already exists in this country.');
    return {
        ...coverage,
        supportedCities: [...(coverage.supportedCities || []), normalized],
        cityServiceAvailability: [
            ...(coverage.cityServiceAvailability || []),
            { city: normalized, status: market_setting_model_1.MarketStatus.ACTIVE, services: [], areas: [] },
        ],
    };
};
exports.addCityToCoverage = addCityToCoverage;
const renameCityInCoverage = (coverage = {}, currentCity, nextCity) => {
    const current = (0, exports.normalizeMarketCityName)(currentCity);
    const next = (0, exports.normalizeMarketCityName)(nextCity);
    if (!current || !next)
        throw new Error('City name is required.');
    if ((0, exports.marketCityKey)(current) !== (0, exports.marketCityKey)(next) && (0, exports.cityExistsInCoverage)(coverage, next)) {
        throw new Error('A city with this name already exists in this country.');
    }
    return {
        ...coverage,
        supportedCities: (coverage.supportedCities || []).map((city) => (0, exports.marketCityKey)(city) === (0, exports.marketCityKey)(current) ? next : city),
        cityServiceAvailability: (coverage.cityServiceAvailability || []).map((row) => (0, exports.marketCityKey)(row.city) === (0, exports.marketCityKey)(current) ? { ...row, city: next } : row),
    };
};
exports.renameCityInCoverage = renameCityInCoverage;
const cityHasEmbeddedOperationalConfiguration = (coverage = {}, cityName) => {
    const key = (0, exports.marketCityKey)(cityName);
    const row = (coverage.cityServiceAvailability || []).find((item) => (0, exports.marketCityKey)(item.city) === key);
    if (!row)
        return false;
    return Boolean((row.services || []).length || (row.areas || []).length);
};
exports.cityHasEmbeddedOperationalConfiguration = cityHasEmbeddedOperationalConfiguration;
const removeCityFromCoverage = (coverage = {}, cityName) => {
    const normalized = (0, exports.normalizeMarketCityName)(cityName);
    if (!normalized)
        throw new Error('City name is required.');
    return {
        ...coverage,
        supportedCities: (coverage.supportedCities || []).filter((city) => (0, exports.marketCityKey)(city) !== (0, exports.marketCityKey)(normalized)),
        cityServiceAvailability: (coverage.cityServiceAvailability || []).filter((row) => (0, exports.marketCityKey)(row.city) !== (0, exports.marketCityKey)(normalized)),
    };
};
exports.removeCityFromCoverage = removeCityFromCoverage;
const findCityInCoverage = (coverage = {}, cityName) => {
    const key = (0, exports.marketCityKey)(cityName);
    return (coverage.cityServiceAvailability || []).find((row) => (0, exports.marketCityKey)(row.city) === key);
};
exports.findCityInCoverage = findCityInCoverage;
const ensureCityRow = (coverage = {}, cityName) => {
    const normalizedCity = (0, exports.normalizeMarketCityName)(cityName);
    const existing = (0, exports.findCityInCoverage)(coverage, normalizedCity);
    if (existing)
        return existing;
    if (!(0, exports.cityExistsInCoverage)(coverage, normalizedCity))
        throw new Error('City not found in this country.');
    return { city: normalizedCity, status: market_setting_model_1.MarketStatus.ACTIVE, services: [], areas: [] };
};
const areaNamesFromCity = (coverage = {}, cityName) => {
    const row = (0, exports.findCityInCoverage)(coverage, cityName);
    return (row?.areas || [])
        .map((area) => (0, exports.normalizeMarketAreaName)(area?.name))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
};
exports.areaNamesFromCity = areaNamesFromCity;
const areaExistsInCity = (coverage = {}, cityName, areaName) => (0, exports.areaNamesFromCity)(coverage, cityName).some((area) => (0, exports.marketAreaKey)(area) === (0, exports.marketAreaKey)(areaName));
exports.areaExistsInCity = areaExistsInCity;
const updateCityRow = (coverage = {}, cityName, update) => {
    const normalizedCity = (0, exports.normalizeMarketCityName)(cityName);
    const row = ensureCityRow(coverage, normalizedCity);
    const rows = coverage.cityServiceAvailability || [];
    const hasRow = rows.some((item) => (0, exports.marketCityKey)(item.city) === (0, exports.marketCityKey)(normalizedCity));
    const nextRows = hasRow
        ? rows.map((item) => (0, exports.marketCityKey)(item.city) === (0, exports.marketCityKey)(normalizedCity) ? update(item) : item)
        : [...rows, update(row)];
    return { ...coverage, cityServiceAvailability: nextRows };
};
const addAreaToCity = (coverage = {}, cityName, areaName) => {
    const normalizedArea = (0, exports.normalizeMarketAreaName)(areaName);
    if (!normalizedArea)
        throw new Error('Area name is required.');
    if ((0, exports.areaExistsInCity)(coverage, cityName, normalizedArea))
        throw new Error('An area with this name already exists in this city.');
    return updateCityRow(coverage, cityName, (row) => ({
        ...row,
        areas: [...(row.areas || []), { name: normalizedArea, status: market_setting_model_1.MarketStatus.ACTIVE, services: [] }],
    }));
};
exports.addAreaToCity = addAreaToCity;
const renameAreaInCity = (coverage = {}, cityName, currentArea, nextArea) => {
    const current = (0, exports.normalizeMarketAreaName)(currentArea);
    const next = (0, exports.normalizeMarketAreaName)(nextArea);
    if (!current || !next)
        throw new Error('Area name is required.');
    if ((0, exports.marketAreaKey)(current) !== (0, exports.marketAreaKey)(next) && (0, exports.areaExistsInCity)(coverage, cityName, next)) {
        throw new Error('An area with this name already exists in this city.');
    }
    return updateCityRow(coverage, cityName, (row) => ({
        ...row,
        areas: (row.areas || []).map((area) => (0, exports.marketAreaKey)(area.name) === (0, exports.marketAreaKey)(current) ? { ...area, name: next } : area),
    }));
};
exports.renameAreaInCity = renameAreaInCity;
const areaHasEmbeddedOperationalConfiguration = (coverage = {}, cityName, areaName) => {
    const row = (0, exports.findCityInCoverage)(coverage, cityName);
    const area = (row?.areas || []).find((item) => (0, exports.marketAreaKey)(item.name) === (0, exports.marketAreaKey)(areaName));
    return Boolean(area && (area.services || []).length);
};
exports.areaHasEmbeddedOperationalConfiguration = areaHasEmbeddedOperationalConfiguration;
const removeAreaFromCity = (coverage = {}, cityName, areaName) => {
    const normalizedArea = (0, exports.normalizeMarketAreaName)(areaName);
    if (!normalizedArea)
        throw new Error('Area name is required.');
    return updateCityRow(coverage, cityName, (row) => ({
        ...row,
        areas: (row.areas || []).filter((area) => (0, exports.marketAreaKey)(area.name) !== (0, exports.marketAreaKey)(normalizedArea)),
    }));
};
exports.removeAreaFromCity = removeAreaFromCity;
//# sourceMappingURL=market-city.service.js.map