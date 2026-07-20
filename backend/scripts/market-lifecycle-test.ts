import assert from 'assert';
import {
  CurrencyCode,
  fromMinorUnits,
  normalizeIsoCountryCode,
  normalizeIsoCurrencyCode,
  toMinorUnits,
} from '../src/config/market.config';
import { MarketStatus } from '../src/models/market-setting.model';
import {
  MARKET_STATUS_TRANSITIONS,
  isAllowedMarketStatusTransition,
} from '../src/services/market-lifecycle.service';
import MarketSetting from '../src/models/market-setting.model';
import {
  addCityToCoverage,
  addAreaToCity,
  areaHasEmbeddedOperationalConfiguration,
  areaNamesFromCity,
  cityHasEmbeddedOperationalConfiguration,
  cityNamesFromCoverage,
  removeAreaFromCity,
  removeCityFromCoverage,
  renameAreaInCity,
  renameCityInCoverage,
} from '../src/services/market-city.service';

const allowed: Array<[MarketStatus, MarketStatus]> = [
  [MarketStatus.DRAFT, MarketStatus.COMING_SOON],
  [MarketStatus.DRAFT, MarketStatus.ACTIVE],
  [MarketStatus.COMING_SOON, MarketStatus.ACTIVE],
  [MarketStatus.ACTIVE, MarketStatus.PAUSED],
  [MarketStatus.PAUSED, MarketStatus.ACTIVE],
  [MarketStatus.ACTIVE, MarketStatus.DISABLED],
  [MarketStatus.DISABLED, MarketStatus.ACTIVE],
  [MarketStatus.DISABLED, MarketStatus.ARCHIVED],
];

allowed.forEach(([from, to]) => {
  assert.strictEqual(isAllowedMarketStatusTransition(from, to), true, `${from} -> ${to} should be allowed`);
});

const rejected: Array<[MarketStatus, MarketStatus]> = [
  [MarketStatus.ARCHIVED, MarketStatus.ACTIVE],
  [MarketStatus.ARCHIVED, MarketStatus.DRAFT],
  [MarketStatus.ACTIVE, MarketStatus.DRAFT],
  [MarketStatus.DISABLED, MarketStatus.PAUSED],
  [MarketStatus.DRAFT, MarketStatus.PAUSED],
];

rejected.forEach(([from, to]) => {
  assert.strictEqual(isAllowedMarketStatusTransition(from, to), false, `${from} -> ${to} should be rejected`);
});

assert.deepStrictEqual(MARKET_STATUS_TRANSITIONS[MarketStatus.ARCHIVED], [MarketStatus.ARCHIVED]);

assert.strictEqual(toMinorUnits(450.75, CurrencyCode.ZAR), 45075);
assert.strictEqual(fromMinorUnits(45075, CurrencyCode.ZAR), 450.75);
assert.strictEqual(toMinorUnits(90000, CurrencyCode.UGX), 90000);
assert.strictEqual(fromMinorUnits(90000, CurrencyCode.UGX), 90000);
assert.strictEqual(toMinorUnits(60000, CurrencyCode.TZS), 60000);
assert.strictEqual(fromMinorUnits(60000, CurrencyCode.TZS), 60000);
assert.strictEqual(toMinorUnits(30000, CurrencyCode.RWF), 30000);
assert.strictEqual(fromMinorUnits(30000, CurrencyCode.RWF), 30000);
assert.strictEqual(toMinorUnits(1.234, 'KWD'), 1234);
assert.strictEqual(fromMinorUnits(1234, 'KWD'), 1.234);
assert.strictEqual(toMinorUnits(12.34, 'XTS'), 1234);
assert.strictEqual(normalizeIsoCountryCode(' za '), 'ZA');
assert.strictEqual(normalizeIsoCountryCode('xk'), 'XK');
assert.throws(() => normalizeIsoCountryCode('south africa'), /Invalid ISO country code/);
assert.throws(() => normalizeIsoCountryCode('ZAF'), /Invalid ISO country code/);
assert.strictEqual(normalizeIsoCurrencyCode(' zar '), 'ZAR');
assert.strictEqual(normalizeIsoCurrencyCode('xts'), 'XTS');
assert.throws(() => normalizeIsoCurrencyCode('RAND'), /Invalid currency code/);

const marketIndexes = MarketSetting.schema.indexes();
assert(
  marketIndexes.some(([fields, options]) => fields['identity.countryCode'] === 1 && options?.unique === true),
  'MarketSetting must keep identity.countryCode as the canonical unique country index'
);
assert(
  !marketIndexes.some(([fields, options]) => fields.countryCode === 1 && options?.unique === true),
  'MarketSetting must not define a legacy top-level countryCode unique index'
);

const ugCoverage = addCityToCoverage({ supportedCities: [], cityServiceAvailability: [], serviceCategories: ['electrical'] }, ' Kampala  ');
assert.deepStrictEqual(cityNamesFromCoverage(ugCoverage), ['Kampala']);
assert.strictEqual(ugCoverage.serviceCategories?.[0], 'electrical');
assert.throws(() => addCityToCoverage(ugCoverage, 'kampala'), /already exists/i);

const zaCoverage = addCityToCoverage({ supportedCities: ['Pretoria'], cityServiceAvailability: [] }, 'Johannesburg');
assert.deepStrictEqual(cityNamesFromCoverage(zaCoverage), ['Johannesburg', 'Pretoria']);
assert.deepStrictEqual(cityNamesFromCoverage(ugCoverage), ['Kampala']);

const renamedCoverage = renameCityInCoverage(ugCoverage, 'kampala', 'Kampala Central');
assert.deepStrictEqual(cityNamesFromCoverage(renamedCoverage), ['Kampala Central']);
assert.strictEqual(cityNamesFromCoverage(ugCoverage)[0], 'Kampala');

const configuredCoverage = {
  supportedCities: ['Kampala'],
  cityServiceAvailability: [{ city: 'Kampala', services: [{ serviceKey: 'electrical', status: MarketStatus.ACTIVE }], areas: [] }],
};
assert.strictEqual(cityHasEmbeddedOperationalConfiguration(configuredCoverage, 'Kampala'), true);
assert.deepStrictEqual(cityNamesFromCoverage(removeCityFromCoverage(ugCoverage, 'Kampala')), []);

const areaCoverage = addAreaToCity(ugCoverage, 'Kampala', ' Kololo  ');
assert.deepStrictEqual(areaNamesFromCity(areaCoverage, 'Kampala'), ['Kololo']);
assert.throws(() => addAreaToCity(areaCoverage, 'Kampala', 'kololo'), /already exists/i);

const renamedAreaCoverage = renameAreaInCity(areaCoverage, 'Kampala', 'kololo', 'Kololo Central');
assert.deepStrictEqual(areaNamesFromCity(renamedAreaCoverage, 'Kampala'), ['Kololo Central']);
assert.deepStrictEqual(areaNamesFromCity(areaCoverage, 'Kampala'), ['Kololo']);

const multiCityCoverage = addCityToCoverage(areaCoverage, 'Jinja');
const multiCityAreaCoverage = addAreaToCity(addAreaToCity(multiCityCoverage, 'Jinja', 'Central'), 'Kampala', 'Central');
assert(areaNamesFromCity(multiCityAreaCoverage, 'Jinja').includes('Central'));
assert(areaNamesFromCity(multiCityAreaCoverage, 'Kampala').includes('Central'));

const configuredAreaCoverage = {
  supportedCities: ['Kampala'],
  cityServiceAvailability: [{
    city: 'Kampala',
    services: [],
    areas: [{ name: 'Ntinda', status: MarketStatus.ACTIVE, services: [{ serviceKey: 'electrical', status: MarketStatus.ACTIVE }] }],
  }],
};
assert.strictEqual(areaHasEmbeddedOperationalConfiguration(configuredAreaCoverage, 'Kampala', 'Ntinda'), true);
assert.deepStrictEqual(areaNamesFromCity(removeAreaFromCity(areaCoverage, 'Kampala', 'Kololo'), 'Kampala'), []);

console.log('Market lifecycle and currency minor-unit tests passed.');
