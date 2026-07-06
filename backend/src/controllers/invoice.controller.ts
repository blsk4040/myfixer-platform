// c:/myfixer-platform/backend/src/controllers/invoice.controller.ts
import { Request, Response } from 'express';
import { Invoice } from '../models/billing.model';
import { fromMinorUnits } from '../config/market.config';

export const getInvoicesByUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role; // 'CUSTOMER' or 'TECHNICIAN'

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized. User context missing.' });
      return;
    }

    // Dynamic field filtering based on the role targeting MongoDB collections
    const filter = userRole === 'CUSTOMER' ? { customerId: userId } : { technicianId: userId };
    
    // Fetch and populate related user fields elegantly via Mongoose
    const invoices = await Invoice.find(filter)
      .populate('bookingId', 'sub_category_name address_text')
      .populate('customerId', 'first_name last_name email')
      .populate('technicianId', 'first_name last_name')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, invoices });
  } catch (error) {
    console.error('Error fetching MongoDB invoices:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

export const downloadInvoicePDF = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const invoice = await Invoice.findById(id)
      .populate('bookingId')
      .populate('customerId', 'first_name last_name email')
      .populate('technicianId', 'first_name last_name');

    if (!invoice) {
      res.status(404).json({ success: false, message: 'Invoice not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      meta: {
        document_type: "TAX INVOICE",
        invoice_number: invoice.invoiceNumber,
        date: invoice.createdAt,
        country_code: invoice.countryCode,
        currency: invoice.currency
      },
      breakdown: {
        base_diagnostic_callout: fromMinorUnits(invoice.baseAmountMinor, invoice.currency),
        base_diagnostic_callout_minor: invoice.baseAmountMinor,
        additional_labor: fromMinorUnits(invoice.additionalLaborMinor, invoice.currency),
        additional_labor_minor: invoice.additionalLaborMinor,
        parts_and_materials: fromMinorUnits(invoice.partsAmountMinor, invoice.currency),
        parts_and_materials_minor: invoice.partsAmountMinor,
        total_due: fromMinorUnits(invoice.totalAmountMinor, invoice.currency),
        total_due_minor: invoice.totalAmountMinor
      }
    });
  } catch (error) {
    console.error('Error fetching invoice details:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
