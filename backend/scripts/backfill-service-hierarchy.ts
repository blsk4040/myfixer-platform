import mongoose from 'mongoose';
import { pathToFileURL } from 'url';
import ServiceCatalog, { ServicePublicationStatus } from '../src/models/service-catalog.model';
import { MarketStatus } from '../src/models/market-setting.model';

export type GroupMapping = {
  groupKey: string;
  groupLabel: string;
  groupDisplayOrder: number;
};

export type CatalogueInput = {
  serviceKey?: string;
  categoryKey?: string;
  groupKey?: string;
  groupLabel?: string;
  groupStatus?: string;
  groupDisplayOrder?: number;
  requiresCapabilityApproval?: boolean;
  capabilityRequirements?: unknown;
  status?: string;
  subcategories?: Array<{
    subcategoryKey?: string;
    serviceKey?: string;
    label?: string;
    status?: string;
    publicationStatus?: string;
    searchKeywords?: string[];
    synonyms?: string[];
    requiresCapabilityApproval?: boolean;
    capabilityRequirements?: unknown;
  }>;
};

export type ServicePlan = {
  serviceKey: string;
  skipped: boolean;
  skipReason?: string;
  updates: Record<string, unknown>;
  subcategoryUpdates: Array<{
    subcategoryKey: string;
    updates: Record<string, unknown>;
  }>;
  conflicts: string[];
};

export type BackfillAnalysis = {
  dryRun: boolean;
  zeroDatabaseWrites: boolean;
  scanned: number;
  alreadyComplete: number;
  requiringUpdates: number;
  skipped: Array<{ serviceKey: string; reason: string }>;
  manualMappingRequired: string[];
  conflicts: Array<{ serviceKey: string; issues: string[] }>;
  duplicateServiceKeys: string[];
  proposedGroupAssignments: Array<{ serviceKey: string; groupKey: string; groupLabel: string }>;
  proposedCategoryAssignments: Array<{ serviceKey: string; categoryKey: string }>;
  subcategoriesReceivingServiceKey: Array<{ serviceKey: string; subcategoryKey: string; finalServiceKey: string }>;
  plans: ServicePlan[];
};

const SAFE_GROUP_MAPPINGS: Record<string, GroupMapping> = {
  appliance_repair: { groupKey: 'home_services', groupLabel: 'Home Services', groupDisplayOrder: 10 },
  electrical: { groupKey: 'home_services', groupLabel: 'Home Services', groupDisplayOrder: 10 },
  plumbing: { groupKey: 'home_services', groupLabel: 'Home Services', groupDisplayOrder: 10 },
  cleaning: { groupKey: 'home_services', groupLabel: 'Home Services', groupDisplayOrder: 10 },
  painting: { groupKey: 'home_services', groupLabel: 'Home Services', groupDisplayOrder: 10 },
  gardening: { groupKey: 'home_services', groupLabel: 'Home Services', groupDisplayOrder: 10 },
  maintenance: { groupKey: 'home_services', groupLabel: 'Home Services', groupDisplayOrder: 10 },
  automotive: { groupKey: 'auto_services', groupLabel: 'Auto Services', groupDisplayOrder: 20 },
};

const KNOWN_UNCERTAIN_SERVICE_KEYS = new Set(['managed_collection', 'rental_property']);

const SERVICE_STATUSES = new Set(Object.values(ServicePublicationStatus));
const MARKET_STATUSES = new Set(Object.values(MarketStatus));

const normalizeKey = (value: unknown): string =>
  String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const hasValue = (value: unknown): boolean =>
  value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '');

const normalizeStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

const defaultCapabilityRequirements = () => ({
  requiredEvidenceTypes: [],
  equipmentRequired: [],
  licenceRequired: false,
  certificateRequired: false,
  notes: '',
});

const deriveSearchKeywords = (label: unknown, key: string): string[] => {
  const labelValue = String(label || '').trim();
  const values = [labelValue, key.replace(/_/g, ' ')].filter(Boolean);
  return Array.from(new Set(values));
};

const duplicateValues = (values: string[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  values.forEach((value) => {
    if (!value) return;
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });
  return Array.from(duplicates).sort();
};

const hasEmptyCapabilityRequirements = (value: unknown): boolean =>
  !value || (typeof value === 'object' && Object.keys(value as Record<string, unknown>).length === 0);

export const safeServiceHierarchyMappings = SAFE_GROUP_MAPPINGS;

export function analyzeServiceHierarchyBackfill(
  services: CatalogueInput[],
  options: { dryRun?: boolean } = {}
): BackfillAnalysis {
  const dryRun = options.dryRun !== false;
  const plans: ServicePlan[] = [];
  const manualMappingRequired = new Set<string>();
  const proposedGroupAssignments: BackfillAnalysis['proposedGroupAssignments'] = [];
  const proposedCategoryAssignments: BackfillAnalysis['proposedCategoryAssignments'] = [];
  const subcategoriesReceivingServiceKey: BackfillAnalysis['subcategoriesReceivingServiceKey'] = [];
  const skipped: BackfillAnalysis['skipped'] = [];
  const serviceKeys = services.map((service) => normalizeKey(service.serviceKey));
  const duplicateServiceKeys = duplicateValues(serviceKeys);

  services.forEach((service) => {
    const serviceKey = normalizeKey(service.serviceKey);
    const plan: ServicePlan = {
      serviceKey: serviceKey || '(missing_service_key)',
      skipped: false,
      updates: {},
      subcategoryUpdates: [],
      conflicts: [],
    };

    if (!serviceKey) {
      plan.skipped = true;
      plan.skipReason = 'Missing or invalid ServiceCatalog.serviceKey.';
      plan.conflicts.push(plan.skipReason);
      plans.push(plan);
      return;
    }

    const mapping = SAFE_GROUP_MAPPINGS[serviceKey];
    if (!mapping || KNOWN_UNCERTAIN_SERVICE_KEYS.has(serviceKey)) {
      const reason = 'Manual mapping required before hierarchy backfill.';
      manualMappingRequired.add(serviceKey);
      plan.skipped = true;
      plan.skipReason = reason;
      skipped.push({ serviceKey, reason });
      plans.push(plan);
      return;
    }

    if (service.status && !SERVICE_STATUSES.has(service.status as ServicePublicationStatus)) {
      plan.conflicts.push(`Unsupported service status: ${service.status}`);
    }
    if (service.groupStatus && !SERVICE_STATUSES.has(service.groupStatus as ServicePublicationStatus)) {
      plan.conflicts.push(`Unsupported group status: ${service.groupStatus}`);
    }

    const existingGroupKey = normalizeKey(service.groupKey);
    const existingGroupLabel = String(service.groupLabel || '').trim();
    const existingCategoryKey = normalizeKey(service.categoryKey);

    if (existingGroupKey && existingGroupKey !== mapping.groupKey) {
      plan.conflicts.push(`Existing groupKey "${existingGroupKey}" conflicts with mapped groupKey "${mapping.groupKey}".`);
    }
    if (existingGroupLabel && existingGroupLabel !== mapping.groupLabel) {
      plan.conflicts.push(`Existing groupLabel "${existingGroupLabel}" conflicts with mapped groupLabel "${mapping.groupLabel}".`);
    }
    if (existingCategoryKey && existingCategoryKey !== serviceKey) {
      plan.conflicts.push(`Existing categoryKey "${existingCategoryKey}" conflicts with stable serviceKey "${serviceKey}".`);
    }

    if (!hasValue(service.categoryKey)) {
      plan.updates.categoryKey = serviceKey;
      proposedCategoryAssignments.push({ serviceKey, categoryKey: serviceKey });
    }
    if (!hasValue(service.groupKey)) {
      plan.updates.groupKey = mapping.groupKey;
    }
    if (!hasValue(service.groupLabel)) {
      plan.updates.groupLabel = mapping.groupLabel;
    }
    if (!hasValue(service.groupStatus)) {
      plan.updates.groupStatus = ServicePublicationStatus.PUBLISHED;
    }
    if (!hasValue(service.groupDisplayOrder)) {
      plan.updates.groupDisplayOrder = mapping.groupDisplayOrder;
    }
    if (!hasValue(service.requiresCapabilityApproval)) {
      plan.updates.requiresCapabilityApproval = true;
    }
    if (!hasValue(service.capabilityRequirements) || hasEmptyCapabilityRequirements(service.capabilityRequirements)) {
      plan.updates.capabilityRequirements = defaultCapabilityRequirements();
    }
    if (!hasValue(service.groupKey) || !hasValue(service.groupLabel) || !hasValue(service.groupDisplayOrder)) {
      proposedGroupAssignments.push({ serviceKey, groupKey: mapping.groupKey, groupLabel: mapping.groupLabel });
    }

    const subcategoryKeys = (service.subcategories || []).map((subcategory) => normalizeKey(subcategory.subcategoryKey));
    const duplicateSubcategoryKeys = duplicateValues(subcategoryKeys);
    duplicateSubcategoryKeys.forEach((key) => {
      plan.conflicts.push(`Duplicate subcategoryKey within ${serviceKey}: ${key}`);
    });

    const finalServiceKeys = (service.subcategories || []).map((subcategory) =>
      normalizeKey(subcategory.serviceKey || subcategory.subcategoryKey)
    );
    const duplicateFinalServiceKeys = duplicateValues(finalServiceKeys);
    duplicateFinalServiceKeys.forEach((key) => {
      plan.conflicts.push(`Duplicate final subcategory serviceKey within ${serviceKey}: ${key}`);
    });

    (service.subcategories || []).forEach((subcategory) => {
      const subcategoryKey = normalizeKey(subcategory.subcategoryKey);
      if (!subcategoryKey) {
        plan.conflicts.push(`Empty or invalid subcategoryKey under ${serviceKey}.`);
        return;
      }
      if (subcategory.status && !MARKET_STATUSES.has(subcategory.status as MarketStatus)) {
        plan.conflicts.push(`Unsupported status for ${subcategoryKey}: ${subcategory.status}`);
      }
      if (subcategory.publicationStatus && !SERVICE_STATUSES.has(subcategory.publicationStatus as ServicePublicationStatus)) {
        plan.conflicts.push(`Unsupported publicationStatus for ${subcategoryKey}: ${subcategory.publicationStatus}`);
      }

      const updates: Record<string, unknown> = {};
      if (!hasValue(subcategory.serviceKey)) {
        updates.serviceKey = subcategoryKey;
        subcategoriesReceivingServiceKey.push({ serviceKey, subcategoryKey, finalServiceKey: subcategoryKey });
      } else if (!normalizeKey(subcategory.serviceKey)) {
        plan.conflicts.push(`Empty or invalid final serviceKey for subcategory "${subcategoryKey}".`);
      }
      if (!hasValue(subcategory.searchKeywords)) {
        updates.searchKeywords = deriveSearchKeywords(subcategory.label, subcategoryKey);
      }
      if (!hasValue(subcategory.requiresCapabilityApproval)) {
        updates.requiresCapabilityApproval = true;
      }
      if (!hasValue(subcategory.capabilityRequirements) || hasEmptyCapabilityRequirements(subcategory.capabilityRequirements)) {
        updates.capabilityRequirements = defaultCapabilityRequirements();
      }
      if (Object.keys(updates).length) {
        plan.subcategoryUpdates.push({ subcategoryKey, updates });
      }
    });

    plans.push(plan);
  });

  const conflicts = plans
    .filter((plan) => plan.conflicts.length)
    .map((plan) => ({ serviceKey: plan.serviceKey, issues: plan.conflicts }));
  const requiringUpdates = plans.filter((plan) =>
    !plan.skipped && (Object.keys(plan.updates).length > 0 || plan.subcategoryUpdates.length > 0)
  ).length;

  return {
    dryRun,
    zeroDatabaseWrites: dryRun,
    scanned: services.length,
    alreadyComplete: services.length - requiringUpdates - skipped.length,
    requiringUpdates,
    skipped,
    manualMappingRequired: Array.from(manualMappingRequired).sort(),
    conflicts,
    duplicateServiceKeys,
    proposedGroupAssignments,
    proposedCategoryAssignments,
    subcategoriesReceivingServiceKey,
    plans,
  };
}

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
const apply = process.argv.includes('--apply') || process.env.APPLY_SERVICE_HIERARCHY_BACKFILL === 'true';
const appEnv = String(process.env.APP_ENV || process.env.NODE_ENV || '').toLowerCase();
const productionLike = appEnv === 'production' || /prod|production|render/i.test(uri);

async function main(): Promise<void> {
  if (!uri.trim()) throw new Error('MONGODB_URI or MONGO_URI is required. No database writes were attempted.');
  if (productionLike && apply && process.env.ALLOW_PRODUCTION_CATALOGUE_BACKFILL !== 'true') {
    throw new Error('Refusing to mutate production-like catalogue data without ALLOW_PRODUCTION_CATALOGUE_BACKFILL=true.');
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  try {
    const services = await ServiceCatalog.find().sort({ serviceKey: 1 });
    const analysis = analyzeServiceHierarchyBackfill(
      services.map((service) => service.toObject() as CatalogueInput),
      { dryRun: !apply }
    );

    if (apply && (analysis.manualMappingRequired.length || analysis.conflicts.length || analysis.duplicateServiceKeys.length)) {
      console.log(JSON.stringify(analysis, null, 2));
      throw new Error('Apply mode refused because manual mappings, duplicate keys, or conflicts were found.');
    }

    let writes = 0;
    if (apply) {
      for (const plan of analysis.plans) {
        if (plan.skipped || plan.conflicts.length) continue;
        if (!Object.keys(plan.updates).length && !plan.subcategoryUpdates.length) continue;
        const service = services.find((candidate) => normalizeKey(candidate.serviceKey) === plan.serviceKey);
        if (!service) continue;

        service.set(plan.updates);
        if (plan.subcategoryUpdates.length) {
          const updatesBySubcategory = new Map(plan.subcategoryUpdates.map((item) => [item.subcategoryKey, item.updates]));
          service.subcategories = (service.subcategories || []).map((subcategory) => {
            const updates = updatesBySubcategory.get(normalizeKey(subcategory.subcategoryKey));
            if (!updates) return subcategory;
            Object.assign(subcategory, updates);
            return subcategory;
          });
        }
        service.audit = {
          ...(service.audit || { changeHistory: [] }),
          changeHistory: [
            ...(service.audit?.changeHistory || []),
            {
              changedAt: new Date(),
              action: 'service.hierarchy_backfill',
              before: {},
              after: { updates: plan.updates, subcategoryUpdates: plan.subcategoryUpdates },
            },
          ],
        };
        await service.save();
        writes += 1;
      }
    }

    console.log(JSON.stringify({
      ...analysis,
      zeroDatabaseWrites: !apply,
      writes,
      message: apply
        ? `Applied hierarchy backfill to ${writes} ServiceCatalog record(s).`
        : 'Dry-run complete. Zero database writes occurred.',
    }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
