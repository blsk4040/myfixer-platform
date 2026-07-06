// src/models/auditLog.model.ts

import mongoose, { Schema, Document } from 'mongoose';

export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export enum AuditModule {
  AUTH = 'AUTH',
  BOOKINGS = 'BOOKINGS',
  TECHNICIANS = 'TECHNICIANS',
  CUSTOMERS = 'CUSTOMERS',
  PAYMENTS = 'PAYMENTS',
  WALLET = 'WALLET',
  MARKET = 'MARKET',
  ADMIN = 'ADMIN',
  SUPPORT = 'SUPPORT',
  NOTIFICATIONS = 'NOTIFICATIONS',
}

export enum AuditAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  ASSIGN = 'ASSIGN',
  ACCEPT = 'ACCEPT',
  CANCEL = 'CANCEL',
  COMPLETE = 'COMPLETE',
  PAYMENT = 'PAYMENT',
  CASHOUT = 'CASHOUT',
  SYSTEM_EVENT = 'SYSTEM_EVENT',
}

export interface IAuditLogDocument extends Document {
  actor: {
    id?: mongoose.Types.ObjectId;
    email: string;
    role: string;
  };

  event: {
    action: AuditAction | string;
    module: AuditModule | string;
    resourceType: string;
    resourceId: string;
    severity: AuditSeverity;
  };

  request: {
    ipAddress: string;
    device: string;
    platform: string;
    appVersion: string;
    userAgent: string;
  };

  changes: {
    before?: unknown;
    after?: unknown;
  };

  metadata: Record<string, unknown>;

  success: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema = new Schema<IAuditLogDocument>(
  {
    actor: {
      id: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      email: {
        type: String,
        default: '',
        trim: true,
        lowercase: true,
      },
      role: {
        type: String,
        default: '',
        trim: true,
      },
    },

    event: {
      action: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },
      module: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },
      resourceType: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },
      resourceId: {
        type: String,
        default: '',
        trim: true,
        index: true,
      },
      severity: {
        type: String,
        enum: Object.values(AuditSeverity),
        default: AuditSeverity.INFO,
        index: true,
      },
    },

    request: {
      ipAddress: {
        type: String,
        default: '',
        trim: true,
      },
      device: {
        type: String,
        default: '',
        trim: true,
      },
      platform: {
        type: String,
        default: '',
        trim: true,
      },
      appVersion: {
        type: String,
        default: '',
        trim: true,
      },
      userAgent: {
        type: String,
        default: '',
        trim: true,
      },
    },

    changes: {
      before: {
        type: Schema.Types.Mixed,
      },
      after: {
        type: Schema.Types.Mixed,
      },
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },

    success: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ 'actor.id': 1, createdAt: -1 });
AuditLogSchema.index({ 'actor.email': 1, createdAt: -1 });
AuditLogSchema.index({ 'event.module': 1, createdAt: -1 });
AuditLogSchema.index({ 'event.action': 1, createdAt: -1 });
AuditLogSchema.index({ 'event.resourceType': 1, 'event.resourceId': 1 });
AuditLogSchema.index({ success: 1, createdAt: -1 });

const AuditLogModel =
  (mongoose.models.AuditLog as mongoose.Model<IAuditLogDocument> | undefined) ??
  mongoose.model<IAuditLogDocument>('AuditLog', AuditLogSchema);

export default AuditLogModel;