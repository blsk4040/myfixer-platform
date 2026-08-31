"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPreLaunchRegistration = void 0;
const prelaunch_registration_model_1 = __importStar(require("../models/prelaunch-registration.model"));
const email_service_1 = require("../services/email/email.service");
const normalizeText = (value) => String(value ?? '').trim();
const normalizeEmail = (value) => normalizeText(value).toLowerCase();
const createPreLaunchRegistration = async (request, response) => {
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
        if (role !== prelaunch_registration_model_1.PreLaunchRegistrationRole.CUSTOMER &&
            role !== prelaunch_registration_model_1.PreLaunchRegistrationRole.PROFESSIONAL) {
            response.status(400).json({
                success: false,
                message: 'A valid registration type is required.',
            });
            return;
        }
        const existingRegistration = await prelaunch_registration_model_1.default.findOne({
            email,
            role,
        });
        if (existingRegistration) {
            response.status(200).json({
                success: true,
                alreadyRegistered: true,
                message: 'You are already registered. We will keep you updated when Padi launches.',
                registration: {
                    id: existingRegistration._id,
                    status: existingRegistration.status,
                },
            });
            return;
        }
        const registration = await prelaunch_registration_model_1.default.create({
            name,
            email,
            phone,
            city,
            role,
            source: 'hellopadi-pre-launch',
            status: prelaunch_registration_model_1.PreLaunchRegistrationStatus.NEW,
            metadata: {
                userAgent: request.get('user-agent') || '',
            },
        });
        const registrationId = registration._id.toString();
        await Promise.allSettled([
            email_service_1.EmailService.sendPreLaunchRegistrationConfirmation({
                recipientEmail: email,
                name,
                city,
                role,
            }),
            email_service_1.EmailService.sendPreLaunchRegistrationNotification({
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
            message: 'Registration received. We will keep you updated on the Padi launch.',
            registration: {
                id: registration._id,
                status: registration.status,
            },
        });
    }
    catch (error) {
        if (error?.code === 11000) {
            response.status(200).json({
                success: true,
                alreadyRegistered: true,
                message: 'You are already registered. We will keep you updated when Padi launches.',
            });
            return;
        }
        console.error('Failed to create pre-launch registration:', error);
        response.status(500).json({
            success: false,
            message: 'Unable to complete your registration right now. Please try again.',
        });
    }
};
exports.createPreLaunchRegistration = createPreLaunchRegistration;
//# sourceMappingURL=prelaunch-registration.controller.js.map