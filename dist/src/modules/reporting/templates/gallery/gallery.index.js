"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findGalleryTemplate = exports.GALLERY_TEMPLATES = void 0;
const gst_invoice_a4_template_1 = require("./gst-invoice-a4.template");
const gst_invoice_a5_template_1 = require("./gst-invoice-a5.template");
const dotmatrix_invoice_dm80_template_1 = require("./dotmatrix-invoice-dm80.template");
const thermal_receipt_t80_template_1 = require("./thermal-receipt-t80.template");
const thermal_receipt_t58_template_1 = require("./thermal-receipt-t58.template");
const party_statement_a4_template_1 = require("./party-statement-a4.template");
exports.GALLERY_TEMPLATES = [
    {
        key: 'gst-invoice-a4',
        name: gst_invoice_a4_template_1.GST_INVOICE_A4_NAME,
        docType: 'SALE_INVOICE',
        outputMode: 'PDF',
        paperCode: 'A4',
        isDefault: true,
        build: gst_invoice_a4_template_1.buildGstInvoiceA4,
    },
    {
        key: 'gst-invoice-a5',
        name: gst_invoice_a5_template_1.GST_INVOICE_A5_NAME,
        docType: 'SALE_INVOICE',
        outputMode: 'PDF',
        paperCode: 'A5',
        isDefault: true,
        build: gst_invoice_a5_template_1.buildGstInvoiceA5,
    },
    {
        key: 'thermal-receipt-t80',
        name: thermal_receipt_t80_template_1.THERMAL_RECEIPT_T80_NAME,
        docType: 'SALE_INVOICE',
        outputMode: 'ESCPOS',
        paperCode: 'T80',
        isDefault: true,
        build: thermal_receipt_t80_template_1.buildThermalReceiptT80,
    },
    {
        key: 'thermal-receipt-t58',
        name: thermal_receipt_t58_template_1.THERMAL_RECEIPT_T58_NAME,
        docType: 'SALE_INVOICE',
        outputMode: 'ESCPOS',
        paperCode: 'T58',
        isDefault: true,
        build: thermal_receipt_t58_template_1.buildThermalReceiptT58,
    },
    {
        key: 'dotmatrix-invoice-dm80',
        name: dotmatrix_invoice_dm80_template_1.DOTMATRIX_INVOICE_DM80_NAME,
        docType: 'SALE_INVOICE',
        outputMode: 'ESCP_DOTMATRIX',
        paperCode: 'DM80',
        isDefault: true,
        build: dotmatrix_invoice_dm80_template_1.buildDotMatrixInvoiceDm80,
    },
    {
        key: 'party-statement-a4',
        name: party_statement_a4_template_1.PARTY_STATEMENT_A4_NAME,
        docType: 'PARTY_STATEMENT',
        outputMode: 'PDF',
        paperCode: 'A4',
        isDefault: true,
        build: party_statement_a4_template_1.buildPartyStatementA4,
    },
];
const findGalleryTemplate = (key) => exports.GALLERY_TEMPLATES.find((entry) => entry.key === key);
exports.findGalleryTemplate = findGalleryTemplate;
//# sourceMappingURL=gallery.index.js.map