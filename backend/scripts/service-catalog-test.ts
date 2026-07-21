import assert from 'assert';
import { readFileSync } from 'fs';
import MarketSetting, { MarketStatus } from '../src/models/market-setting.model';
import ServiceCatalog, {
  ServiceBillingModel,
  ServicePublicationStatus,
  ServiceSubscriptionCadence,
} from '../src/models/service-catalog.model';
import { DEFAULT_SERVICE_DEFINITIONS, getMarketAvailability, validateServiceBookable } from '../src/services/service-availability.service';
import { calculatePriceBreakdown } from '../src/services/price-breakdown.service';
import { analyzeServiceHierarchyBackfill } from './backfill-service-hierarchy';

const originalMarketFindOne = MarketSetting.findOne;
const originalServiceFind = ServiceCatalog.find;

const activeMarket = {
  identity: {
    countryCode: 'ZA',
    countryName: 'South Africa',
    currency: 'ZAR',
    status: MarketStatus.ACTIVE,
  },
  pricing: {
    defaultCalloutFeeMinor: 45000,
  },
  coverage: {
    serviceCategories: [
      {
        serviceKey: 'electrical',
        label: 'Electrical',
        status: MarketStatus.ACTIVE,
        calloutFeeMinor: 48000,
        subcategories: [{ subcategoryKey: 'fault_finding', label: 'Fault Finding', status: MarketStatus.ACTIVE, calloutFeeMinor: 49000 }],
      },
    ],
    cityServiceAvailability: [
      {
        city: 'Pretoria',
        status: MarketStatus.ACTIVE,
        services: [
          {
            serviceKey: 'electrical',
            label: 'Electrical',
            status: MarketStatus.ACTIVE,
            calloutFeeMinor: 49500,
            subcategories: [{ subcategoryKey: 'fault_finding', label: 'Fault Finding', status: MarketStatus.ACTIVE, calloutFeeMinor: 51000 }],
          },
        ],
        areas: [
          {
            name: 'Centurion',
            status: MarketStatus.ACTIVE,
            services: [
              {
                serviceKey: 'electrical',
                label: 'Electrical',
                status: MarketStatus.ACTIVE,
                calloutFeeMinor: 50000,
                subcategories: [{ subcategoryKey: 'fault_finding', label: 'Fault Finding', status: MarketStatus.ACTIVE, calloutFeeMinor: 52500 }],
              },
            ],
          },
        ],
      },
    ],
  },
};

const publishedElectrical = {
  serviceKey: 'electrical',
  label: 'Electrical',
  description: 'Electrical repairs',
  imageKey: 'electrical',
  imageUrl: 'https://cdn.example.test/electrical.png',
  status: ServicePublicationStatus.PUBLISHED,
  defaultCalloutFeeMinor: 47500,
  subcategories: [
    {
      subcategoryKey: 'fault_finding',
      label: 'Fault Finding',
      status: MarketStatus.ACTIVE,
      calloutFeeMinor: 52500,
    },
    {
      subcategoryKey: 'expired_option',
      label: 'Expired Option',
      status: MarketStatus.DISABLED,
      calloutFeeMinor: 30000,
    },
  ],
};

function mockMarket(setting: unknown) {
  (MarketSetting.findOne as unknown) = () => ({
    lean: async () => setting,
  });
}

function mockServices(services: unknown[]) {
  (ServiceCatalog.find as unknown) = () => ({
    select: () => ({
      lean: async () => services,
    }),
  });
}

async function run() {
  try {
    assert.deepStrictEqual(
      DEFAULT_SERVICE_DEFINITIONS
        .filter((service) => service.groupKey === 'home_services')
        .map((service) => service.label),
      [
        'Appliance Repair',
        'Cleaning Service',
        'Electrical Repair',
        'Gardening Service',
        'Maintenance Service',
        'Painting Service',
        'Plumbing',
      ],
      'Default home service categories should remain alphabetical.'
    );

    mockMarket(activeMarket);
    mockServices([]);
    const emptyAvailability = await getMarketAvailability('ZA', 'Pretoria', 'Centurion');
    assert.deepStrictEqual(emptyAvailability.services, [], 'Market assignment without published catalogue service should be hidden.');

    mockMarket({
      ...activeMarket,
      coverage: {
        ...activeMarket.coverage,
        serviceCategories: [],
        cityServiceAvailability: [],
      },
    });
    mockServices([publishedElectrical]);
    const unassignedAvailability = await getMarketAvailability('ZA', 'Pretoria', 'Centurion');
    assert.strictEqual(unassignedAvailability.services.length, 1, 'Published catalogue service should remain visible before explicit City Service assignment is configured.');
    assert.strictEqual(unassignedAvailability.services[0].serviceKey, 'electrical');
    assert.strictEqual(unassignedAvailability.services[0].canBook, true);

    mockMarket(activeMarket);
    mockServices([{
      ...publishedElectrical,
      subcategories: [
        ...publishedElectrical.subcategories,
        {
          subcategoryKey: 'draft_option',
          label: 'Draft Option',
          status: MarketStatus.ACTIVE,
          publicationStatus: ServicePublicationStatus.DRAFT,
          calloutFeeMinor: 30000,
        },
        {
          subcategoryKey: 'archived_option',
          label: 'Archived Option',
          status: MarketStatus.ACTIVE,
          publicationStatus: ServicePublicationStatus.ARCHIVED,
          calloutFeeMinor: 30000,
        },
      ],
    }]);
    const draftFilteredAvailability = await getMarketAvailability('ZA', 'Pretoria', 'Centurion');
    assert.strictEqual(
      draftFilteredAvailability.groups[0].categories[0].services.some((service) => service.serviceKey === 'draft_option'),
      false,
      'Draft bookable services must be hidden from public availability.'
    );
    assert.strictEqual(
      draftFilteredAvailability.groups[0].categories[0].services.some((service) => service.serviceKey === 'archived_option'),
      false,
      'Archived bookable services must be hidden from public availability.'
    );

    mockMarket(activeMarket);
    mockServices([publishedElectrical]);
    const availability = await getMarketAvailability('ZA', 'Pretoria', 'Centurion');
    assert.strictEqual(availability.services.length, 1);
    assert.strictEqual(availability.services[0].serviceKey, 'electrical');
    assert.strictEqual(availability.services[0].imageKey, 'electrical');
    assert.strictEqual(availability.services[0].imageUrl, 'https://cdn.example.test/electrical.png');
    assert.strictEqual(availability.services[0].calloutFeeMinor, 48000);
    assert.strictEqual(availability.services[0].subcategories?.[0]?.calloutFeeMinor, 49000);
    assert.strictEqual(availability.services[0].subcategories?.[0]?.pricingSource, 'MARKET_SUBCATEGORY_OVERRIDE');
    assert.strictEqual(availability.services[0].subcategories?.some((subcategory) => subcategory.subcategoryKey === 'expired_option'), false);
    assert.strictEqual(availability.services[0].canBook, true);
    assert.strictEqual(availability.groups.length, 1);
    assert.strictEqual(availability.groups[0].groupKey, 'home_services');
    assert.strictEqual(availability.groups[0].categories[0].categoryKey, 'electrical');
    assert.strictEqual(availability.groups[0].categories[0].services[0].serviceKey, 'fault_finding');
    assert.strictEqual(availability.groups[0].categories[0].services[0].canBook, true);

    const bookable = await validateServiceBookable({ countryCode: 'ZA', city: 'Pretoria', area: 'Centurion', serviceKey: 'electrical' });
    assert.strictEqual(bookable.allowed, true);
    assert.strictEqual(bookable.service?.calloutFeeMinor, 48000);

    const subcategoryBookable = await validateServiceBookable({
      countryCode: 'ZA',
      city: 'Pretoria',
      area: 'Centurion',
      serviceKey: 'electrical',
      subcategoryKey: 'fault_finding',
    });
    assert.strictEqual(subcategoryBookable.allowed, true);
    assert.strictEqual(subcategoryBookable.service?.calloutFeeMinor, 49000);
    assert.strictEqual(subcategoryBookable.service?.pricingSource, 'MARKET_SUBCATEGORY_OVERRIDE');

    const directBookable = await validateServiceBookable({
      countryCode: 'ZA',
      city: 'Pretoria',
      serviceKey: 'fault_finding',
    });
    assert.strictEqual(directBookable.allowed, true, 'Booking validation should accept an enabled Bookable Service key.');
    assert.strictEqual(directBookable.service?.calloutFeeMinor, 49000);

    const missingSubcategory = await validateServiceBookable({
      countryCode: 'ZA',
      city: 'Pretoria',
      area: 'Centurion',
      serviceKey: 'electrical',
      subcategoryKey: 'expired_option',
    });
    assert.strictEqual(missingSubcategory.allowed, false);

    mockMarket({
      ...activeMarket,
      coverage: {
        ...activeMarket.coverage,
        cityServiceAvailability: [
          { city: 'Johannesburg', status: MarketStatus.ACTIVE, services: [], areas: [{ name: 'Sandton', status: MarketStatus.ACTIVE, services: [] }] },
        ],
      },
    });
    mockServices([publishedElectrical]);
    const cityWithoutManualServices = await getMarketAvailability('ZA', 'Johannesburg', 'Sandton');
    assert.strictEqual(cityWithoutManualServices.services.length, 1, 'Published catalogue services should appear without manual City Services configuration.');
    assert.strictEqual(cityWithoutManualServices.groups[0].categories[0].services[0].serviceKey, 'fault_finding');
    const optionalAreaBooking = await validateServiceBookable({ countryCode: 'ZA', city: 'Johannesburg', serviceKey: 'fault_finding' });
    assert.strictEqual(optionalAreaBooking.allowed, true, 'Booking validation must not require manual City Services configuration or an Area.');

    mockMarket({
      ...activeMarket,
      coverage: {
        ...activeMarket.coverage,
        serviceCategories: [],
        cityServiceAvailability: [{ city: 'Johannesburg', status: MarketStatus.ACTIVE, services: [], areas: [] }],
      },
    });
    mockServices([{
      serviceKey: 'it_support',
      categoryKey: 'it_support',
      groupKey: 'it_services',
      groupLabel: 'IT Services',
      groupStatus: ServicePublicationStatus.PUBLISHED,
      label: 'IT Support',
      description: 'Computer and device support',
      status: ServicePublicationStatus.PUBLISHED,
      defaultCalloutFeeMinor: 35000,
      subcategories: [{
        subcategoryKey: 'computer_repair',
        serviceKey: 'computer_repair',
        label: 'Computer Repair',
        status: MarketStatus.ACTIVE,
        publicationStatus: ServicePublicationStatus.PUBLISHED,
        calloutFeeMinor: 35000,
        billingModel: ServiceBillingModel.SUBSCRIPTION,
        subscriptionEligible: true,
        subscriptionCadences: [ServiceSubscriptionCadence.MONTHLY],
        subscriptionNotes: 'Future monthly support plan candidate.',
      }],
    }]);
    const itAvailability = await getMarketAvailability('ZA', 'Johannesburg');
    assert.strictEqual(itAvailability.groups.length, 1);
    assert.strictEqual(itAvailability.groups[0].label, 'IT Services');
    assert.strictEqual(itAvailability.groups[0].categories[0].label, 'IT Support');
    assert.strictEqual(itAvailability.groups[0].categories[0].status, MarketStatus.ACTIVE);
    assert.strictEqual(itAvailability.groups[0].categories[0].services[0].label, 'Computer Repair');
    assert.strictEqual(itAvailability.groups[0].categories[0].services[0].billingModel, ServiceBillingModel.SUBSCRIPTION);
    assert.strictEqual(itAvailability.groups[0].categories[0].services[0].subscriptionEligible, true);
    assert.deepStrictEqual(itAvailability.groups[0].categories[0].services[0].subscriptionCadences, [ServiceSubscriptionCadence.MONTHLY]);
    assert.strictEqual(itAvailability.services[0].serviceKey, 'it_support');
    const itBooking = await validateServiceBookable({ countryCode: 'ZA', city: 'Johannesburg', serviceKey: 'it_support', subcategoryKey: 'computer_repair' });
    assert.strictEqual(itBooking.allowed, true, 'Computer Repair should be bookable when the published hierarchy is available.');

    mockMarket({
      ...activeMarket,
      pricing: {},
      coverage: {
        serviceCategories: [{ serviceKey: 'electrical', label: 'Electrical', status: MarketStatus.ACTIVE }],
        cityServiceAvailability: [],
      },
    });
    mockServices([{ ...publishedElectrical, defaultCalloutFeeMinor: undefined, subcategories: [] }]);
    const noPrice = await validateServiceBookable({ countryCode: 'ZA', serviceKey: 'electrical' });
    assert.strictEqual(noPrice.allowed, false, 'A service without any resolvable call-out fee must not be bookable.');

    mockMarket({ ...activeMarket, identity: { ...activeMarket.identity, status: MarketStatus.PAUSED } });
    const paused = await validateServiceBookable({ countryCode: 'ZA', city: 'Pretoria', area: 'Centurion', serviceKey: 'electrical' });
    assert.strictEqual(paused.allowed, false);

    const duplicateValidation = new ServiceCatalog({
      serviceKey: 'Air Conditioning & Refrigeration',
      label: 'Air Conditioning & Refrigeration',
      subcategories: [
        { subcategoryKey: 'Refrigerator Repair', label: 'Refrigerator Repair' },
        { subcategoryKey: 'refrigerator_repair', label: 'Fridge Repair' },
      ],
    }).validateSync();
    assert(duplicateValidation, 'Duplicate generated subcategory keys should fail validation.');

    const migrationDryRun = analyzeServiceHierarchyBackfill([
      {
        serviceKey: 'appliance_repair',
        label: 'Appliance Repair',
        status: ServicePublicationStatus.PUBLISHED,
        subcategories: [{ subcategoryKey: 'fridge_repair', label: 'Fridge Repair', status: MarketStatus.ACTIVE }],
      },
    ], { dryRun: true });
    assert.strictEqual(migrationDryRun.zeroDatabaseWrites, true);
    assert.strictEqual(migrationDryRun.scanned, 1);
    assert.strictEqual(migrationDryRun.requiringUpdates, 1);
    assert.strictEqual(migrationDryRun.proposedGroupAssignments[0].groupKey, 'home_services');
    assert.strictEqual(migrationDryRun.proposedCategoryAssignments[0].categoryKey, 'appliance_repair');
    assert.strictEqual(migrationDryRun.subcategoriesReceivingServiceKey[0].finalServiceKey, 'fridge_repair');
    assert.strictEqual(migrationDryRun.plans[0].updates.categoryKey, 'appliance_repair');
    assert.strictEqual(migrationDryRun.plans[0].subcategoryUpdates[0].updates.serviceKey, 'fridge_repair');

    const migrationComplete = analyzeServiceHierarchyBackfill([
      {
        serviceKey: 'appliance_repair',
        categoryKey: 'appliance_repair',
        groupKey: 'home_services',
        groupLabel: 'Home Services',
        groupStatus: ServicePublicationStatus.PUBLISHED,
        groupDisplayOrder: 10,
        requiresCapabilityApproval: true,
        capabilityRequirements: {
          requiredEvidenceTypes: [],
          equipmentRequired: [],
          licenceRequired: false,
          certificateRequired: false,
          notes: '',
        },
        status: ServicePublicationStatus.PUBLISHED,
        subcategories: [{
          subcategoryKey: 'fridge_repair',
          serviceKey: 'fridge_repair',
          label: 'Fridge Repair',
          status: MarketStatus.ACTIVE,
          searchKeywords: ['Fridge Repair'],
          requiresCapabilityApproval: true,
          capabilityRequirements: {
            requiredEvidenceTypes: [],
            equipmentRequired: [],
            licenceRequired: false,
            certificateRequired: false,
            notes: '',
          },
        }],
      },
    ], { dryRun: true });
    assert.strictEqual(migrationComplete.requiringUpdates, 0, 'Migration analysis must be idempotent once hierarchy metadata exists.');

    const unknownMigration = analyzeServiceHierarchyBackfill([
      { serviceKey: 'managed_collection', label: 'Managed Collection Services', status: ServicePublicationStatus.PUBLISHED },
      { serviceKey: 'future_service', label: 'Future Service', status: ServicePublicationStatus.PUBLISHED },
    ], { dryRun: true });
    assert.deepStrictEqual(unknownMigration.manualMappingRequired, ['future_service', 'managed_collection']);
    assert.strictEqual(unknownMigration.skipped.length, 2);

    const conflictMigration = analyzeServiceHierarchyBackfill([
      {
        serviceKey: 'electrical',
        categoryKey: 'power_services',
        groupKey: 'business_services',
        groupLabel: 'Business Services',
        status: ServicePublicationStatus.PUBLISHED,
        subcategories: [
          { subcategoryKey: 'wiring', serviceKey: 'wiring', label: 'Wiring', status: MarketStatus.ACTIVE },
          { subcategoryKey: 'wiring', serviceKey: 'wiring', label: 'Duplicate Wiring', status: MarketStatus.ACTIVE },
        ],
      },
    ], { dryRun: true });
    assert(conflictMigration.conflicts.length > 0, 'Conflicting existing hierarchy data must be reported.');
    assert(conflictMigration.conflicts[0].issues.some((issue) => issue.includes('Existing groupKey')));
    assert(conflictMigration.conflicts[0].issues.some((issue) => issue.includes('Existing categoryKey')));
    assert(conflictMigration.conflicts[0].issues.some((issue) => issue.includes('Duplicate subcategoryKey')));

    const preservedFinalServiceKey = analyzeServiceHierarchyBackfill([
      {
        serviceKey: 'plumbing',
        categoryKey: 'plumbing',
        groupKey: 'home_services',
        groupLabel: 'Home Services',
        groupStatus: ServicePublicationStatus.PUBLISHED,
        groupDisplayOrder: 10,
        requiresCapabilityApproval: true,
        capabilityRequirements: {
          requiredEvidenceTypes: [],
          equipmentRequired: [],
          licenceRequired: false,
          certificateRequired: false,
          notes: '',
        },
        status: ServicePublicationStatus.PUBLISHED,
        subcategories: [{
          subcategoryKey: 'geyser_repair',
          serviceKey: 'hot_water_repair',
          label: 'Geyser Repair',
          status: MarketStatus.ACTIVE,
          searchKeywords: ['Geyser Repair'],
          requiresCapabilityApproval: true,
          capabilityRequirements: {
            requiredEvidenceTypes: [],
            equipmentRequired: [],
            licenceRequired: false,
            certificateRequired: false,
            notes: '',
          },
        }],
      },
    ], { dryRun: true });
    assert.strictEqual(preservedFinalServiceKey.conflicts.length, 0, 'Existing final serviceKey values must be preserved.');
    assert.strictEqual(preservedFinalServiceKey.requiringUpdates, 0);

    const duplicateServiceMigration = analyzeServiceHierarchyBackfill([
      { serviceKey: 'cleaning', label: 'Cleaning', status: ServicePublicationStatus.PUBLISHED },
      { serviceKey: 'Cleaning', label: 'Cleaning Duplicate', status: ServicePublicationStatus.PUBLISHED },
    ], { dryRun: true });
    assert.deepStrictEqual(duplicateServiceMigration.duplicateServiceKeys, ['cleaning']);

    const breakdown = calculatePriceBreakdown({
      currency: 'ZAR',
      calloutFeeMinor: 45000,
      labourMinor: 40000,
      partsMinor: 15000,
      marketPricing: {
        taxLabel: 'VAT',
        taxRateBps: 1500,
        taxInclusive: false,
        clientServiceFeeType: 'FIXED',
        clientServiceFeeMinor: 5000,
        platformCommissionBps: 1500,
      },
    });
    assert.strictEqual(breakdown.subtotalMinor, 100000);
    assert.strictEqual(breakdown.clientServiceFeeMinor, 5000);
    assert.strictEqual(breakdown.taxMinor, 15750);
    assert.strictEqual(breakdown.totalMinor, 120750);
    assert.strictEqual(breakdown.platformCommissionMinor, 15000);
    assert.strictEqual(breakdown.technicianNetMinor, 85000);

    const apiRoutes = readFileSync('src/routes/api.routes.ts', 'utf8');
    assert.strictEqual(apiRoutes.includes('cities/:cityName/services'), false, 'Market Step 4 City Services admin routes must not be registered.');

    console.log('Service catalogue availability tests passed.');
  } finally {
    (MarketSetting.findOne as unknown) = originalMarketFindOne;
    (ServiceCatalog.find as unknown) = originalServiceFind;
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
