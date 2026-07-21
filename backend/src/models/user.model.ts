// src/models/user.model.ts

import mongoose, { Schema, Document } from 'mongoose';
import { CountryCode, CurrencyCode } from '../config/market.config';

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  TECHNICIAN = 'TECHNICIAN',
  ADMIN = 'ADMIN',
}

export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  OPERATIONS_MANAGER = 'OPERATIONS_MANAGER',
  DISPATCHER = 'DISPATCHER',
  FINANCE_ADMIN = 'FINANCE_ADMIN',
  SUPPORT_AGENT = 'SUPPORT_AGENT',
  TECHNICIAN_REVIEWER = 'TECHNICIAN_REVIEWER',
  MARKET_MANAGER = 'MARKET_MANAGER',
  READ_ONLY_ADMIN = 'READ_ONLY_ADMIN',
}

export enum AdminPermission {
  OVERVIEW_READ = 'overview.read',
  BOOKINGS_READ = 'bookings.read',
  BOOKINGS_UPDATE = 'bookings.update',
  TECHNICIANS_READ = 'technicians.read',
  TECHNICIANS_REVIEW = 'technicians.review',
  FINANCE_READ = 'finance.read',
  PROMOTIONS_READ = 'promotions.read',
  PROMOTIONS_CREATE = 'promotions.create',
  PROMOTIONS_UPDATE = 'promotions.update',
  PROMOTIONS_ACTIVATE = 'promotions.activate',
  PROMOTIONS_PAUSE = 'promotions.pause',
  PROMOTIONS_ARCHIVE = 'promotions.archive',
  PROMOTIONS_PERFORMANCE_READ = 'promotions.performance.read',
  PROMOTIONS_REDEMPTIONS_READ = 'promotions.redemptions.read',
  CLIENTS_CONTACT_READ = 'clients.contact.read',
  MARKETS_READ = 'markets.read',
  MARKETS_UPDATE = 'markets.update',
  MARKETS_SERVICES_ACTIVATE = 'markets.services.activate',
  SUPPORT_READ = 'support.read',
  SUPPORT_REPLY = 'support.reply',
  SUPPORT_UPDATE = 'support.update',
  ADMINS_READ = 'admins.read',
  ADMINS_CREATE = 'admins.create',
  ADMINS_UPDATE = 'admins.update',
  SETTINGS_READ = 'settings.read',
}

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATED = 'DEACTIVATED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}

export interface User {
  id: string;
  role: UserRole;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  role: UserRole;
  phoneNumber: string;
  firstName: string;
  lastName: string;
}

export interface UserRow {
  id: string;
  role: UserRole;
  phone_number: string;
  first_name: string;
  last_name: string;
  created_at: Date;
  updated_at: Date;
}

export interface IUserDocument extends Document {
  name: string;
  email: string;
  phone: string;

  profilePhotoUrl: string;

  location: {
    country: string;
    city: string;
    area?: string;
  };

  defaultServiceAddress?: {
    streetAddress: string;
    suburb: string;
    city: string;
    postalCode: string;
    countryCode: string;
    fullAddress: string;
    coordinates?: {
      type: 'Point';
      coordinates: [number, number];
    } | null;
    updatedAt?: Date | null;
  };

  profileCompleted: boolean;

  countryCode: string;
  currency: string;

  password: string;

  role: UserRole;
  adminRole?: AdminRole;
  adminPermissions: AdminPermission[];

  accountStatus: AccountStatus;
  isActive: boolean;

  emailVerified: boolean;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  phoneVerified: boolean;

  lastLoginAt?: Date | null;
  lastPasswordChangeAt?: Date | null;
  mustChangePassword: boolean;

  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date | null;

  refreshTokenVersion: number;

  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;

  metadata: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

export const normalizeUserRole = (role: unknown): UserRole => {
  if (typeof role !== 'string') return UserRole.CUSTOMER;

  const normalized = role.trim().toUpperCase();

  if (normalized === 'CLIENT' || normalized === 'CUSTOMER') return UserRole.CUSTOMER;
  if (normalized === 'TECH' || normalized === 'TECHNICIAN') return UserRole.TECHNICIAN;
  if (normalized === 'ADMIN' || normalized === 'SUPER_ADMIN') return UserRole.ADMIN;

  return UserRole.CUSTOMER;
};

const DefaultServiceAddressSchema = new Schema(
  {
    streetAddress: {
      type: String,
      default: '',
      trim: true,
    },
    suburb: {
      type: String,
      default: '',
      trim: true,
    },
    city: {
      type: String,
      default: '',
      trim: true,
    },
    postalCode: {
      type: String,
      default: '',
      trim: true,
    },
    countryCode: {
      type: String,
      uppercase: true,
      validate: { validator: (value: string) => /^[A-Z]{2}$/.test(value), message: 'Invalid ISO country code.' },
    },
    fullAddress: {
      type: String,
      default: '',
      trim: true,
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
        validate: {
          validator(value: number[]) {
            return value === undefined || (Array.isArray(value) && value.length === 2 && value.every((item) => Number.isFinite(item)));
          },
          message: 'Default service address coordinates must be [longitude, latitude].',
        },
        default: undefined,
      },
    },
    updatedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const UserSchema = new Schema<IUserDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    profilePhotoUrl: {
      type: String,
      default: '',
      trim: true,
    },

    location: {
      country: {
        type: String,
        default: 'South Africa',
        trim: true,
      },
      city: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },
      area: {
        type: String,
        default: '',
        trim: true,
      },
    },

    defaultServiceAddress: {
      type: DefaultServiceAddressSchema,
      default: null,
    },

    profileCompleted: {
      type: Boolean,
      default: true,
      index: true,
    },

    countryCode: {
      type: String,
      uppercase: true,
      validate: { validator: (value: string) => /^[A-Z]{2}$/.test(value), message: 'Invalid ISO country code.' },
      required: true,
      index: true,
    },

    currency: {
      type: String,
      uppercase: true,
      validate: { validator: (value: string) => /^[A-Z]{3}$/.test(value), message: 'Invalid currency code.' },
      required: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.CUSTOMER,
      index: true,
    },

    adminRole: {
      type: String,
      enum: Object.values(AdminRole),
      default: undefined,
      index: true,
    },

    adminPermissions: {
      type: [String],
      enum: Object.values(AdminPermission),
      default: [],
    },

    accountStatus: {
      type: String,
      enum: Object.values(AccountStatus),
      default: AccountStatus.ACTIVE,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    emailVerified: {
      type: Boolean,
      default: false,
      index: true,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
      index: true,
    },

    emailVerificationToken: {
      type: String,
      default: '',
      select: false,
      index: true,
    },

    phoneVerified: {
      type: Boolean,
      default: false,
      index: true,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    lastPasswordChangeAt: {
      type: Date,
      default: null,
    },

    mustChangePassword: {
      type: Boolean,
      default: false,
      index: true,
    },

    passwordResetTokenHash: {
      type: String,
      default: '',
      select: false,
    },

    passwordResetExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },

    refreshTokenVersion: {
      type: Number,
      default: 0,
      min: 0,
      select: false,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ phone: 1 });
UserSchema.index({ role: 1, accountStatus: 1 });
UserSchema.index({ countryCode: 1, role: 1 });
UserSchema.index({ 'location.city': 1, role: 1 });
UserSchema.index({ adminRole: 1, role: 1 });

const UserModel =
  (mongoose.models.User as mongoose.Model<IUserDocument> | undefined) ??
  mongoose.model<IUserDocument>('User', UserSchema);

export default UserModel;
