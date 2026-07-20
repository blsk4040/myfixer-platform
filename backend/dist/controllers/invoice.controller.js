"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadInvoicePDF = exports.getInvoicesByUser = void 0;
const billing_model_1 = require("../models/billing.model");
const market_config_1 = require("../config/market.config");
const getInvoicesByUser = async (req, res) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role; // 'CUSTOMER' or 'TECHNICIAN'
        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized. User context missing.' });
            return;
        }
        // Dynamic field filtering based on the role targeting MongoDB collections
        const filter = userRole === 'CUSTOMER' ? { customerId: userId } : { technicianId: userId };
        // Fetch and populate related user fields elegantly via Mongoose
        const invoices = await billing_model_1.Invoice.find(filter)
            .populate('bookingId', 'sub_category_name address_text')
            .populate('customerId', 'first_name last_name email')
            .populate('technicianId', 'first_name last_name')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, invoices });
    }
    catch (error) {
        console.error('Error fetching MongoDB invoices:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
exports.getInvoicesByUser = getInvoicesByUser;
const downloadInvoicePDF = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const invoice = await billing_model_1.Invoice.findById(id)
            .populate('bookingId')
            .populate('customerId', 'first_name last_name email')
            .populate('technicianId', 'first_name last_name');
        if (!invoice) {
            res.status(404).json({ success: false, message: 'Invoice not found.' });
            return;
        }
        const priceBreakdown = invoice.metadata?.priceBreakdown;
        const promotion = invoice.metadata?.promotion;
        const discountMinor = typeof priceBreakdown?.discountMinor === 'number'
            ? priceBreakdown.discountMinor
            : typeof promotion?.discountMinor === 'number'
                ? promotion.discountMinor
                : 0;
        res.status(200).json({
            success: true,
            meta: {
                document_type: "TAX INVOICE",
                invoice_number: invoice.invoiceNumber,
                date: invoice.createdAt,
                country_code: invoice.countryCode,
                currency: invoice.currency,
                promotion: promotion || null,
            },
            breakdown: {
                base_diagnostic_callout: (0, market_config_1.fromMinorUnits)(invoice.baseAmountMinor, invoice.currency),
                base_diagnostic_callout_minor: invoice.baseAmountMinor,
                additional_labor: (0, market_config_1.fromMinorUnits)(invoice.additionalLaborMinor, invoice.currency),
                additional_labor_minor: invoice.additionalLaborMinor,
                parts_and_materials: (0, market_config_1.fromMinorUnits)(invoice.partsAmountMinor, invoice.currency),
                parts_and_materials_minor: invoice.partsAmountMinor,
                promo_discount: (0, market_config_1.fromMinorUnits)(discountMinor, invoice.currency),
                promo_discount_minor: discountMinor,
                service_fee_minor: typeof priceBreakdown?.clientServiceFeeMinor === 'number' ? priceBreakdown.clientServiceFeeMinor : 0,
                tax_minor: typeof priceBreakdown?.taxMinor === 'number' ? priceBreakdown.taxMinor : 0,
                platform_commission_minor: invoice.platformCommissionAmountMinor,
                technician_net_minor: invoice.technicianNetAmountMinor,
                total_due: (0, market_config_1.fromMinorUnits)(invoice.totalAmountMinor, invoice.currency),
                total_due_minor: invoice.totalAmountMinor,
                price_breakdown: priceBreakdown || null,
            }
        });
    }
    catch (error) {
        console.error('Error fetching invoice details:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
exports.downloadInvoicePDF = downloadInvoicePDF;
//# sourceMappingURL=invoice.controller.js.map