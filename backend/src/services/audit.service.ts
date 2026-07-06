import { Request } from 'express';
import mongoose from 'mongoose';
import AuditLog, { AuditModule, AuditSeverity } from '../models/audit-log.model';

interface AuditActor {
  id?: string | mongoose.Types.ObjectId;
  email?: string;
  role?: string;
}

interface AuditEventInput {
  action: string;
  module: AuditModule | string;
  resourceType: string;
  resourceId?: string;
  severity?: AuditSeverity;
  metadata?: Record<string, unknown>;
  changes?: {
    before?: unknown;
    after?: unknown;
  };
  success?: boolean;
}

const getActor = (req: Request): AuditActor =>
  ((req as any).user || {}) as AuditActor;

export const logAuditEvent = async (req: Request, input: AuditEventInput): Promise<void> => {
  const actor = getActor(req);
  const actorId = actor.id ? String(actor.id) : '';

  await AuditLog.create({
    actor: {
      id: actorId && mongoose.Types.ObjectId.isValid(actorId) ? new mongoose.Types.ObjectId(actorId) : undefined,
      email: actor.email || '',
      role: actor.role || '',
    },
    event: {
      action: input.action,
      module: input.module,
      resourceType: input.resourceType,
      resourceId: input.resourceId || '',
      severity: input.severity || AuditSeverity.INFO,
    },
    request: {
      ipAddress: req.ip || '',
      device: '',
      platform: '',
      appVersion: '',
      userAgent: String(req.headers['user-agent'] || ''),
    },
    changes: input.changes || {},
    metadata: input.metadata || {},
    success: input.success ?? true,
  });
};
