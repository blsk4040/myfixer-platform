import mongoose, { Document, Schema } from 'mongoose';
import { MarketStatus } from './market-setting.model';

export enum ServicePublicationStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  PAUSED = 'PAUSED',
  ARCHIVED = 'ARCHIVED',
}

export enum ServiceBillingModel {
  ON_DEMAND = 'ON_DEMAND',
  SUBSCRIPTION = 'SUBSCRIPTION',
}

export enum ServiceSubscriptionCadence {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

const MAX_SERVICE_PRICE_MINOR = 100_000_000;

export interface IServiceSubcategory {
  subcategoryKey: string;
  serviceKey?: string;
  label: string;
  description?: string;
  status: MarketStatus;
  publicationStatus?: ServicePublicationStatus;
  displayOrder?: number;
  imageKey?: string;
  imageUrl?: string;
  searchKeywords?: string[];
  synonyms?: string[];
  estimatedDurationMinutes?: number;
  inspectionRequired?: boolean;
  fixedPriceSupported?: boolean;
  requiresCapabilityApproval?: boolean;
  capabilityRequirements?: {
    requiredEvidenceTypes?: string[];
    equipmentRequired?: string[];
    licenceRequired?: boolean;
    certificateRequired?: boolean;
    notes?: string;
  };
  calloutFeeMinor?: number;
  calloutFeeEnabled?: boolean;
  minimumChargeMinor?: number;
  billingModel?: ServiceBillingModel;
  subscriptionEligible?: boolean;
  subscriptionCadences?: ServiceSubscriptionCadence[];
  subscriptionNotes?: string;
}

export interface IServiceCatalogDocument extends Document {
  serviceKey: string;
  categoryKey?: string;
  groupKey?: string;
  groupLabel?: string;
  groupDescription?: string;
  groupImageKey?: string;
  groupImageUrl?: string;
  groupIconKey?: string;
  groupStatus?: ServicePublicationStatus;
  groupDisplayOrder?: number;
  label: string;
  description: string;
  internalNotes?: string;
  imageKey: string;
  imageUrl?: string;
  iconKey?: string;
  searchKeywords?: string[];
  synonyms?: string[];
  status: ServicePublicationStatus;
  displayOrder?: number;
  defaultCalloutFeeMinor?: number;
  minimumChargeMinor?: number;
  fixedPriceSupported?: boolean;
  requiresCapabilityApproval?: boolean;
  capabilityRequirements?: {
    requiredEvidenceTypes?: string[];
    equipmentRequired?: string[];
    licenceRequired?: boolean;
    certificateRequired?: boolean;
    notes?: string;
  };
  subcategories: IServiceSubcategory[];
  audit: {
    updatedBy?: mongoose.Types.ObjectId;
    changeHistory: {
      changedBy?: mongoose.Types.ObjectId;
      changedAt: Date;
      action: string;
      before?: unknown;
      after?: unknown;
    }[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const normalizeKey = (value: string): string =>
  String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const normalizeStringList = (values: unknown): string[] =>
  Array.isArray(values)
    ? values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .slice(0, 50)
    : [];

const CapabilityRequirementsSchema = new Schema(
  {
    requiredEvidenceTypes: {
      type: [String],
      default: [],
      set: normalizeStringList,
    },
    equipmentRequired: {
      type: [String],
      default: [],
      set: normalizeStringList,
    },
    licenceRequired: {
      type: Boolean,
      default: false,
    },
    certificateRequired: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1200,
    },
  },
  { _id: false }
);

const ServiceSubcategorySchema = new Schema<IServiceSubcategory>(
  {
    subcategoryKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      set: normalizeKey,
    },
    serviceKey: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      set: normalizeKey,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1200,
    },
    status: {
      type: String,
      enum: Object.values(MarketStatus),
      default: MarketStatus.ACTIVE,
    },
    publicationStatus: {
      type: String,
      enum: Object.values(ServicePublicationStatus),
      default: ServicePublicationStatus.PUBLISHED,
    },
    displayOrder: {
      type: Number,
      default: 0,
      min: 0,
    },
    imageKey: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
      set: normalizeKey,
    },
    imageUrl: {
      type: String,
      default: '',
      trim: true,
      validate: {
        validator(value: string) {
          return !value || /^https:\/\/[^\s]+$/i.test(value);
        },
        message: 'Image URL must be HTTPS.',
      },
    },
    searchKeywords: {
      type: [String],
      default: [],
      set: normalizeStringList,
    },
    synonyms: {
      type: [String],
      default: [],
      set: normalizeStringList,
    },
    estimatedDurationMinutes: {
      type: Number,
      min: 0,
      default: undefined,
    },
    inspectionRequired: {
      type: Boolean,
      default: false,
    },
    fixedPriceSupported: {
      type: Boolean,
      default: false,
    },
    requiresCapabilityApproval: {
      type: Boolean,
      default: true,
    },
    capabilityRequirements: {
      type: CapabilityRequirementsSchema,
      default: () => ({}),
    },
    calloutFeeMinor: {
      type: Number,
      min: 0,
      max: MAX_SERVICE_PRICE_MINOR,
      default: undefined,
    },
    calloutFeeEnabled: {
      type: Boolean,
      default: undefined,
    },
    minimumChargeMinor: {
      type: Number,
      min: 0,
      max: MAX_SERVICE_PRICE_MINOR,
      default: undefined,
    },
    billingModel: {
      type: String,
      enum: Object.values(ServiceBillingModel),
      default: ServiceBillingModel.ON_DEMAND,
    },
    subscriptionEligible: {
      type: Boolean,
      default: false,
    },
    subscriptionCadences: {
      type: [String],
      enum: Object.values(ServiceSubscriptionCadence),
      default: [],
    },
    subscriptionNotes: {
      type: String,
      default: '',
      trim: true,
      maxlength: 800,
    },
  },
  { _id: false }
);

const ServiceCatalogSchema = new Schema<IServiceCatalogDocument>(
  {
    serviceKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      set: normalizeKey,
    },
    categoryKey: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      set: normalizeKey,
    },
    groupKey: {
      type: String,
      trim: true,
      lowercase: true,
      default: 'home_services',
      set: normalizeKey,
      index: true,
    },
    groupLabel: {
      type: String,
      default: 'Home Services',
      trim: true,
    },
    groupDescription: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1200,
    },
    groupImageKey: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
      set: normalizeKey,
    },
    groupImageUrl: {
      type: String,
      default: '',
      trim: true,
      validate: {
        validator(value: string) {
          return !value || /^https:\/\/[^\s]+$/i.test(value);
        },
        message: 'Group image URL must be HTTPS.',
      },
    },
    groupIconKey: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
      set: normalizeKey,
    },
    groupStatus: {
      type: String,
      enum: Object.values(ServicePublicationStatus),
      default: ServicePublicationStatus.PUBLISHED,
      index: true,
    },
    groupDisplayOrder: {
      type: Number,
      min: 0,
      default: 0,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1200,
    },
    internalNotes: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },
    imageKey: {
      type: String,
      default: 'maintenance',
      trim: true,
      lowercase: true,
      set: normalizeKey,
    },
    imageUrl: {
      type: String,
      default: '',
      trim: true,
      validate: {
        validator(value: string) {
          return !value || /^https:\/\/[^\s]+$/i.test(value);
        },
        message: 'Image URL must be HTTPS.',
      },
    },
    iconKey: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
      set: normalizeKey,
    },
    searchKeywords: {
      type: [String],
      default: [],
      set: normalizeStringList,
    },
    synonyms: {
      type: [String],
      default: [],
      set: normalizeStringList,
    },
    status: {
      type: String,
      enum: Object.values(ServicePublicationStatus),
      default: ServicePublicationStatus.DRAFT,
      index: true,
    },
    defaultCalloutFeeMinor: {
      type: Number,
      min: 0,
      max: MAX_SERVICE_PRICE_MINOR,
      default: undefined,
    },
    minimumChargeMinor: {
      type: Number,
      min: 0,
      max: MAX_SERVICE_PRICE_MINOR,
      default: undefined,
    },
    fixedPriceSupported: {
      type: Boolean,
      default: false,
    },
    requiresCapabilityApproval: {
      type: Boolean,
      default: true,
    },
    capabilityRequirements: {
      type: CapabilityRequirementsSchema,
      default: () => ({}),
    },
    displayOrder: {
      type: Number,
      min: 0,
      default: 0,
    },
    subcategories: {
      type: [ServiceSubcategorySchema],
      default: [],
      validate: {
        validator(values: IServiceSubcategory[]) {
          const keys = (values || []).map((item) => normalizeKey(item.subcategoryKey)).filter(Boolean);
          return new Set(keys).size === keys.length;
        },
        message: 'Subcategory keys must be unique within a service.',
      },
    },
    audit: {
      updatedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      changeHistory: {
        type: [
          new Schema(
            {
              changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
              changedAt: { type: Date, default: Date.now },
              action: { type: String, required: true, trim: true },
              before: { type: Schema.Types.Mixed },
              after: { type: Schema.Types.Mixed },
            },
            { _id: false }
          ),
        ],
        default: [],
      },
    },
  },
  { timestamps: true }
);

ServiceCatalogSchema.index({ status: 1, serviceKey: 1 });
ServiceCatalogSchema.index({ groupKey: 1, status: 1, displayOrder: 1 });

const ServiceCatalogModel =
  (mongoose.models.ServiceCatalog as mongoose.Model<IServiceCatalogDocument> | undefined) ??
  mongoose.model<IServiceCatalogDocument>('ServiceCatalog', ServiceCatalogSchema);

export default ServiceCatalogModel;
