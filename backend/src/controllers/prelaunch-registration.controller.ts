import { Request, Response } from 'express';
import PreLaunchRegistration, {
  PreLaunchRegistrationRole,
  PreLaunchRegistrationStatus,
} from '../models/prelaunch-registration.model';
import { EmailService } from '../services/email/email.service';

const normalizeText = (value: unknown): string =>
  String(value ?? '').trim();

const normalizeEmail = (value: unknown): string =>
  normalizeText(value).toLowerCase();

export const createPreLaunchRegistration = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const body = request.body || {};

    const name = normalizeText(body.name);
    const email = normalizeEmail(body.email);
    const phone = normalizeText(body.phone);
    const city = normalizeText(body.city);
    const role = normalizeText(body.role).toUpperCase();

    if (!name) {
      response.status(400).json({
        success: false,
        message: 'Name is required.',
      });
      return;
    }

    if (!email || !email.includes('@')) {
      response.status(400).json({
        success: false,
        message: 'A valid email address is required.',
      });
      return;
    }

    if (!phone) {
      response.status(400).json({
        success: false,
        message: 'Phone number is required.',
      });
      return;
    }

    if (!city) {
      response.status(400).json({
        success: false,
        message: 'City is required.',
      });
      return;
    }

    if (
      role !== PreLaunchRegistrationRole.CUSTOMER &&
      role !== PreLaunchRegistrationRole.PROFESSIONAL
    ) {
      response.status(400).json({
        success: false,
        message: 'A valid registration type is required.',
      });
      return;
    }

    const existingRegistration =
      await PreLaunchRegistration.findOne({
        email,
        role,
      });

    if (existingRegistration) {
      response.status(200).json({
        success: true,
        alreadyRegistered: true,
        message:
          'You are already registered. We will keep you updated when Padi launches.',
        registration: {
          id: existingRegistration._id,
          status: existingRegistration.status,
        },
      });
      return;
    }

    const registration = await PreLaunchRegistration.create({
      name,
      email,
      phone,
      city,
      role,
      source: 'hellopadi-pre-launch',
      status: PreLaunchRegistrationStatus.NEW,
      metadata: {
        userAgent: request.get('user-agent') || '',
      },
    });

    const registrationId = registration._id.toString();

    await Promise.allSettled([
      EmailService.sendPreLaunchRegistrationConfirmation({
        recipientEmail: email,
        name,
        city,
        role,
      }),

      EmailService.sendPreLaunchRegistrationNotification({
        name,
        email,
        phone,
        city,
        role,
        registrationId,
      }),
    ]);

    response.status(201).json({
      success: true,
      alreadyRegistered: false,
      message:
        'Registration received. We will keep you updated on the Padi launch.',
      registration: {
        id: registration._id,
        status: registration.status,
      },
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      response.status(200).json({
        success: true,
        alreadyRegistered: true,
        message:
          'You are already registered. We will keep you updated when Padi launches.',
      });
      return;
    }

    console.error(
      'Failed to create pre-launch registration:',
      error
    );

    response.status(500).json({
      success: false,
      message:
        'Unable to complete your registration right now. Please try again.',
    });
  }
};