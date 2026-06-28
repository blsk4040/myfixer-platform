"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadInvoicePDF = exports.getInvoicesByUser = void 0;
const billing_model_1 = require("../models/billing.model");
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
        res.status(200).json({
            success: true,
            meta: {
                document_type: "TAX INVOICE",
                invoice_number: invoice.invoiceNumber,
                date: invoice.createdAt
            },
            breakdown: {
                base_diagnostic_callout: invoice.baseAmount,
                additional_labor: invoice.additionalLabor,
                parts_and_materials: invoice.partsAmount,
                total_due: invoice.totalAmount
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