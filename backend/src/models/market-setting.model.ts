// src/models/marketSetting.model.ts

import mongoose, { Schema, Document } from 'mongoose';
import { PaymentProviderCode } from '../config/market.config';

export enum MarketStatus {
  COMING_SOON = 'COMING_SOON',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  DISABLED = 'DISABLED',
}

export enum PaymentProviderStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
  TESTING = 'TESTING',
  FALLBACK = 'FALLBACK',
}

export interface IMarketSettingDocument extends Document {
  identity: {
    countryCode: string;
    countryName: string;
    currency: string;
    locale: string;
    status: MarketStatus;
    enabled: boolean;
  };

  pricing: {
    defaultCalloutFeeMinor: number;
    platformCommissionBps: number;
    taxLabel: string;
  };

  coverage: {
    supportedCities: string[];
    serviceCategories: Array<
      | string
      | {
          serviceKey: string;
          label: string;
          status: MarketStatus;
        }
    >;
    cityServiceAvailability: {
      city: string;
      status: MarketStatus;
      services: Array<
        | string
        | {
            serviceKey: string;
            label: string;
            status: MarketStatus;
          }
      >;
      areas?: {
        name: string;
        status: MarketStatus;
        services: {
          serviceKey: string;
          label?: string;
          status: MarketStatus;
        }[];
      }[];
    }[];
  };

  payments: {
    paymentProviders: PaymentProviderCode[];
    providerSettings: {
      provider: PaymentProviderCode | string;
      status: PaymentProviderStatus;
      methods: string[];
      priority: number;
      payoutEnabled: boolean;
      configReference: string;
    }[];
  };

  support: {
    email: string;
    phone: string;
    whatsapp: string;
    escalationEmail: string;
  };

  audit: {
    updatedBy?: mongoose.Types.ObjectId;
    changeHistory: {
      changedBy?: mongoose.Types.ObjectId;
      changedAt: Date;
      section: string;
      action: string;
      before?: unknown;
      after?: unknown;
    }[];
  };

  createdAt: Date;
  updatedAt: Date;
}

const CityServiceAvailabilitySchema = new Schema(
  {
    city: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(MarketStatus),
      default: MarketStatus.ACTIVE,
    },
    services: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    areas: {
      type: [
        new Schema(
          {
            name: {
              type: String,
              required: true,
              trim: true,
            },
            status: {
              type: String,
              enum: Object.values(MarketStatus),
              default: MarketStatus.ACTIVE,
            },
            services: {
              type: [
                new Schema(
                  {
                    serviceKey: {
                      type: String,
                      required: true,
                      trim: true,
                      lowercase: true,
                    },
                    label: {
                      type: String,
                      default: '',
                      trim: true,
                    },
                    status: {
                      type: String,
                      enum: Object.values(MarketStatus),
                      default: MarketStatus.ACTIVE,
                    },
                  },
                  { _id: false }
                ),
              ],
              default: [],
            },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { _id: false }
);

const PaymentProviderSettingSchema = new Schema(
  {
    provider: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: Object.values(PaymentProviderStatus),
      default: PaymentProviderStatus.DISABLED,
    },
    methods: {
      type: [String],
      default: [],
    },
    priority: {
      type: Number,
      default: 1,
      min: 1,
    },
    payoutEnabled: {
      type: Boolean,
      default: false,
    },
    configReference: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

const ChangeHistorySchema = new Schema(
  {
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    section: {
      type: String,
      required: true,
      trim: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    before: {
      type: Schema.Types.Mixed,
    },
    after: {
      type: Schema.Types.Mixed,
    },
  },
  { _id: false }
);

const MarketSettingSchema = new Schema<IMarketSettingDocument>(
  {
    identity: {
      countryCode: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
      },
      countryName: {
        type: String,
        required: true,
        trim: true,
      },
      currency: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
      },
      locale: {
        type: String,
        required: true,
        trim: true,
      },
      status: {
        type: String,
        enum: Object.values(MarketStatus),
        default: MarketStatus.DISABLED,
      },
      enabled: {
        type: Boolean,
        default: false,
      },
    },

    pricing: {
      defaultCalloutFeeMinor: {
        type: Number,
        required: true,
        min: 0,
      },
      platformCommissionBps: {
        type: Number,
        required: true,
        min: 0,
        max: 10000,
      },
      taxLabel: {
        type: String,
        default: 'VAT',
        trim: true,
      },
    },

    coverage: {
      supportedCities: {
        type: [String],
        default: [],
      },
      serviceCategories: {
        type: [Schema.Types.Mixed],
        default: [],
      },
      cityServiceAvailability: {
        type: [CityServiceAvailabilitySchema],
        default: [],
      },
    },

    payments: {
      paymentProviders: {
        type: [String],
        default: [],
      },
      providerSettings: {
        type: [PaymentProviderSettingSchema],
        default: [],
      },
    },

    support: {
      email: {
        type: String,
        default: '',
        trim: true,
        lowercase: true,
      },
      phone: {
        type: String,
        default: '',
        trim: true,
      },
      whatsapp: {
        type: String,
        default: '',
        trim: true,
      },
      escalationEmail: {
        type: String,
        default: '',
        trim: true,
        lowercase: true,
      },
    },

    audit: {
      updatedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      changeHistory: {
        type: [ChangeHistorySchema],
        default: [],
      },
    },
  },
  { timestamps: true }
);

MarketSettingSchema.index({ 'identity.countryCode': 1 }, { unique: true });
MarketSettingSchema.index({ 'identity.status': 1 });
MarketSettingSchema.index({ 'identity.enabled': 1 });
MarketSettingSchema.index({ 'coverage.supportedCities': 1 });

const MarketSettingModel =
  (mongoose.models.MarketSetting as mongoose.Model<IMarketSettingDocument> | undefined) ??
  mongoose.model<IMarketSettingDocument>('MarketSetting', MarketSettingSchema);

export default MarketSettingModel;
