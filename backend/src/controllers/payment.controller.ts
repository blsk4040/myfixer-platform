// src/controllers/payment.controller.ts
import { Response } from 'express';
import PaymentVault from '../models/paymentVault.model';
import { PaystackService } from '../services/paystack.service';
import { AuthenticatedRequest } from '../types/auth.types';
import crypto from 'crypto';

export class PaymentController {
  
  static async getCards(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user._id; 
      const vault = await PaymentVault.findOne({ userId });
      
      if (!vault) {
        res.status(200).json([]);
        return;
      }

      const cards = vault.paymentMethods.map(m => ({
        methodId: m.methodId,
        brand: m.brand,
        last4: m.last4,
        expiryMonth: m.expiryMonth,
        expiryYear: m.expiryYear,
        isDefault: m.methodId === vault.defaultMethodId,
      }));

      res.status(200).json(cards);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async saveCard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user._id;
      const { transactionReference } = req.body;

      const paystackData = await PaystackService.verifyTransaction(transactionReference);
      if (paystackData.data.status !== 'success') {
        res.status(400).json({ error: 'Transaction validation verification failed.' });
        return;
      }

      const { authorization, customer } = paystackData.data;
      
      if (!authorization.reusable) {
        res.status(400).json({ error: 'Payment card method cannot be saved for recurring access operations.' });
        return;
      }

      let vault = await PaymentVault.findOne({ userId });
      if (!vault) {
        vault = new PaymentVault({
          userId,
          gatewayCustomerId: customer.customer_code,
          paymentMethods: [],
        });
      }

      const cardExists = vault.paymentMethods.some(m => m.signature === authorization.signature);
      if (cardExists) {
        res.status(200).json({ message: 'Card variant structural instance already mapped.', vault });
        return;
      }

      const generatedMethodId = `pm_${crypto.randomBytes(8).toString('hex')}`;
      
      const newCard = {
        methodId: generatedMethodId,
        authorizationCode: authorization.authorization_code,
        signature: authorization.signature,
        reusable: authorization.reusable,
        brand: authorization.brand,
        bank: authorization.bank,
        countryCode: authorization.country_code,
        last4: authorization.last4,
        expiryMonth: authorization.exp_month,
        expiryYear: authorization.exp_year,
        cardType: authorization.card_type,
        isDefault: vault.paymentMethods.length === 0,
        createdAt: new Date(),
      };

      vault.paymentMethods.push(newCard);
      
      if (vault.paymentMethods.length === 1) {
        vault.defaultMethodId = generatedMethodId;
      }

      await vault.save();
      res.status(201).json({ message: 'Secure token mapping verified successfully.', methodId: generatedMethodId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async chargeSavedCard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user._id;
      const { amountInCents, bookingId } = req.body;

      if (!req.user.email) {
        res.status(400).json({ error: 'Authenticated user email is required to charge a saved card.' });
        return;
      }

      const normalizedAmount = Number(amountInCents);
      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0 || !bookingId) {
        res.status(400).json({ error: 'A valid amountInCents and bookingId are required.' });
        return;
      }

      const vault = await PaymentVault.findOne({ userId });
      const targetMethodId = vault?.defaultMethodId;
      const targetCard = vault?.paymentMethods.find(m => m.methodId === targetMethodId);

      if (!vault || !targetCard) {
        res.status(400).json({ error: 'No validated payment profiles found on this identity root context.' });
        return;
      }

      const uniqueReference = `chg_${bookingId}_${crypto.randomBytes(4).toString('hex')}`;
      
      const chargeResult = await PaystackService.chargeToken(
        req.user.email,
        normalizedAmount,
        targetCard.authorizationCode,
        uniqueReference
      );

      res.status(200).json({ status: chargeResult.data.status, reference: uniqueReference });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteCard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user._id;
      const { id } = req.params;

      const vault = await PaymentVault.findOne({ userId });
      if (!vault) {
        res.status(404).json({ error: 'Payment repository trace entity missing.' });
        return;
      }

      vault.paymentMethods = vault.paymentMethods.filter(m => m.methodId !== id);
      
      if (vault.defaultMethodId === id && vault.paymentMethods.length > 0) {
        vault.defaultMethodId = vault.paymentMethods[0].methodId;
      }

      await vault.save();
      res.status(200).json({ message: 'Tokenized structural references purged successfully.' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async setDefaultCard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user._id;
      const { id } = req.params;

      const vault = await PaymentVault.findOne({ userId });
      if (!vault) {
        res.status(404).json({ error: 'Vault execution domain error.' });
        return;
      }

      const hasCard = vault.paymentMethods.some(m => m.methodId === id);
      if (!hasCard) {
        res.status(404).json({ error: 'Specified payment reference mismatch.' });
        return;
      }

      vault.defaultMethodId = id;
      await vault.save();

      res.status(200).json({ message: 'Default pointer re-indexed successfully.' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
