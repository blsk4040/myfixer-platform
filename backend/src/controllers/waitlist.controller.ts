import { Request, Response } from 'express';
import mongoose from 'mongoose';
import ServiceWaitlist, {
  ServiceWaitlistSource,
  ServiceWaitlistStatus,
} from '../models/service-waitlist.model';
import { logAuditEvent } from '../services/audit.service';
import {
  getMarketAvailability,
  normalizeServiceKey,
  normalizeText,
} from '../services/service-availability.service';
import { normalizeCountryCode } from '../config/market.config';

const getAuthenticatedUser = (request: Request) =>
  (request as any).user as
    | { id?: string; _id?: string; email?: string; role?: string }
    | undefined;

export const joinServiceWaitlist = async (request: Request, response: Response): Promise<void> => {
  const body = request.body || {};
  const authUser = getAuthenticatedUser(request);
  const countryCode = normalizeCountryCode(body.countryCode ?? body.country_code);
  const city = normalizeText(body.city);
  const area = normalizeText(body.area ?? body.neighbourhood ?? body.neighborhood);
  const serviceKey = normalizeServiceKey(body.serviceKey ?? body.service_key);
  const email = normalizeText(body.email ?? authUser?.email).toLowerCase();
  const phone = normalizeText(body.phone);
  const customerId = normalizeText(body.customerId ?? authUser?.id ?? authUser?._id);

  if (!email || !email.includes('@')) {
    response.status(400).json({ message: 'A valid email address is required.' });
    return;
  }

  if (!city || !serviceKey) {
    response.status(400).json({ message: 'City and service are required to join the waitlist.' });
    return;
  }

  const availability = await getMarketAvailability(countryCode, city, area);
  const service = availability.services.find((item) => item.serviceKey === serviceKey);
  if (!service) {
    response.status(404).json({ message: 'This service is not configured for the selected location.' });
    return;
  }

  if (service.canBook) {
    response.status(409).json({ message: 'This service is already available in your area. You can book it now.' });
    return;
  }

  try {
    const waitlist = await ServiceWaitlist.findOneAndUpdate(
      {
        email,
        countryCode,
        city,
        area,
        serviceKey,
      },
      {
        $setOnInsert: {
          customerId: customerId && mongoose.Types.ObjectId.isValid(customerId)
            ? new mongoose.Types.ObjectId(customerId)
            : undefined,
          email,
          phone,
          countryCode,
          city,
          area,
          serviceKey,
          status: ServiceWaitlistStatus.WAITING,
          source: ServiceWaitlistSource.CLIENT_APP,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await logAuditEvent(request, {
      action: 'service_waitlist.join',
      module: 'MARKETS',
      resourceType: 'ServiceWaitlist',
      resourceId: waitlist._id.toString(),
      metadata: {
        countryCode,
        city,
        area,
        serviceKey,
        email,
        status: waitlist.status,
      },
    });

    response.status(200).json({
      success: true,
      message: 'You are on the waitlist. We will notify you when this service launches in your area.',
      waitlist: {
        id: waitlist._id,
        countryCode: waitlist.countryCode,
        city: waitlist.city,
        area: waitlist.area,
        serviceKey: waitlist.serviceKey,
        status: waitlist.status,
      },
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      response.status(200).json({
        success: true,
        message: 'You are already on the waitlist for this service.',
      });
      return;
    }

    console.error('Failed to join service waitlist:', error);
    response.status(500).json({ message: 'Unable to join the waitlist right now.' });
  }
};
