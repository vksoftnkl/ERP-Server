"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocRegisterService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const statutory_service_1 = require("./statutory.service");
let DocRegisterService = class DocRegisterService {
    prisma;
    statutory;
    constructor(prisma, statutory) {
        this.prisma = prisma;
        this.statutory = statutory;
    }
    async write(tx, doc, opts = {}) {
        const interState = opts.interState ?? doc.supplyNature === 'INTER_STATE';
        const [einv, eway] = await Promise.all([
            this.statutory.einvoiceApplicable(doc.companyId, doc.docDate, {
                aatoAmount: opts.aatoAmount ?? null,
                companyFlag: opts.companyEinvoiceFlag ?? false,
            }, tx),
            this.statutory.ewayApplicable(doc.companyId, doc.billValue, doc.docDate, { interState, stateCode: doc.placeOfSupplyCode ?? null }, tx),
        ]);
        const einvoiceApplicable = doc.docType === 'BILL_OF_SUPPLY' ||
            doc.docType === 'DELIVERY_CHALLAN' ||
            doc.docType === 'CHALLAN'
            ? false
            : einv.applicable;
        const [row] = await tx.$queryRaw `
      INSERT INTO accounts.acc_voucher_doc_register (
        gdr_source_module, gdr_tran_nature, gdr_doc_flow, gdr_doc_sign,
        gdr_source_doc_id, gdr_acc_year, gdr_company_id, gdr_branch_id,
        gdr_voucher_type_id, gdr_voucher_id, gdr_voucher_no, gdr_voucher_date,
        gdr_voucher_refno,
        gdr_doc_type, gdr_doc_no, gdr_doc_date, gdr_doc_ref_no, gdr_doc_status,
        gdr_supply_class, gdr_taxability, gdr_supply_nature,
        gdr_place_of_supply_code, gdr_place_of_supply_name,
        gdr_is_reverse_charge, gdr_is_einvoice_applicable, gdr_is_ewaybill_applicable,
        gdr_party_type, gdr_party_id, gdr_party_name,
        gdr_party_addr1, gdr_party_addr2, gdr_party_addr3,
        gdr_party_location, gdr_party_pin,
        gdr_party_state_code, gdr_party_state_name,
        gdr_party_gst_type, gdr_party_gstin,
        gdr_gross_value, gdr_discount_value, gdr_taxable_value,
        gdr_cgst_value, gdr_sgst_value, gdr_igst_value,
        gdr_cess_value, gdr_state_cess_value, gdr_tcs_value,
        gdr_other_charge, gdr_round_off, gdr_bill_value,
        gdr_remarks, gdr_igst_on_intra, gdr_created_by
      ) VALUES (
        ${doc.sourceModule ?? 'SALES'}::accounts."GdrSourceModule",
        ${doc.tranNature}::accounts."GdrTranNature",
        ${doc.docFlow}::accounts."GdrDocFlow",
        ${doc.docSign}::int,
        ${doc.sourceDocId}::uuid, ${doc.accYear}::char(9),
        ${doc.companyId}::uuid, ${doc.branchId}::uuid,
        ${doc.voucherTypeId}::int, ${doc.voucherId}::uuid,
        ${doc.voucherNo}::bigint, ${doc.voucherDate}::date,
        ${doc.voucherRefno ?? null},
        ${doc.docType}::accounts."GdrDocType", ${doc.docNo}, ${doc.docDate}::date,
        ${doc.docRefNo ?? null}, 'POSTED'::accounts."GdrDocStatus",
        ${doc.supplyClass ?? null}::accounts."GdrSupplyClass",
        ${doc.taxability}::accounts."GdrTaxability",
        ${doc.supplyNature ?? null}::accounts."GdrSupplyNature",
        ${doc.placeOfSupplyCode ?? null}, ${doc.placeOfSupplyName ?? null},
        ${doc.isReverseCharge ?? false}, ${einvoiceApplicable}, ${eway.applicable},
        ${doc.partyType ?? 'CUSTOMER'}::accounts."GdrPartyType", ${doc.partyId}::uuid, ${doc.partyName ?? null},
        ${doc.partyAddr1 ?? null}, ${doc.partyAddr2 ?? null}, ${doc.partyAddr3 ?? null},
        ${doc.partyLocation ?? null}, ${doc.partyPin ?? null},
        ${doc.partyStateCode ?? null}, ${doc.partyStateName ?? null},
        ${doc.partyGstType ?? null}, ${doc.partyGstin ?? null},
        ${money(doc.grossValue)}::numeric, ${money(doc.discountValue)}::numeric,
        ${money(doc.taxableValue)}::numeric,
        ${money(doc.cgstValue)}::numeric, ${money(doc.sgstValue)}::numeric,
        ${money(doc.igstValue)}::numeric,
        ${money(doc.cessValue)}::numeric, ${money(doc.stateCessValue)}::numeric,
        ${money(doc.tcsValue)}::numeric,
        ${money(doc.otherCharge)}::numeric, ${money(doc.roundOff)}::numeric,
        ${money(doc.billValue)}::numeric,
        ${doc.remarks ?? null}, ${doc.igstOnIntra ?? false}, ${uuidOrNull(doc.createdBy)}::uuid
      )
      RETURNING gdr_id`;
        const gdrId = row.gdr_id;
        const lineCount = await this.writeDetails(tx, doc, gdrId);
        return {
            gdrId,
            einvoiceApplicable,
            ewaybillApplicable: eway.applicable,
            lineCount,
        };
    }
    async registerIdOf(c, sourceDocId, accYear) {
        const rows = await c.$queryRaw `
      SELECT gdr_id FROM accounts.acc_voucher_doc_register
       WHERE gdr_source_doc_id = ${sourceDocId}::uuid AND gdr_acc_year = ${accYear}::char(9)
         AND gdr_is_deleted = false
       ORDER BY (gdr_doc_status <> 'CANCELED'::accounts."GdrDocStatus") DESC, gdr_created_on DESC
       LIMIT 1`;
        return rows[0]?.gdr_id ?? null;
    }
    async registerIdOfVoucher(c, voucherId, accYear) {
        const rows = await c.$queryRaw `
      SELECT gdr_id FROM accounts.acc_voucher_doc_register
       WHERE gdr_voucher_id = ${voucherId}::uuid AND gdr_acc_year = ${accYear}::char(9)
         AND gdr_is_deleted = false
       ORDER BY (gdr_doc_status <> 'CANCELED'::accounts."GdrDocStatus") DESC, gdr_created_on DESC
       LIMIT 1`;
        return rows[0]?.gdr_id ?? null;
    }
    async cancel(tx, gdrId, accYear, reason, actor = 'SYSTEM') {
        return tx.$executeRaw `
      UPDATE accounts.acc_voucher_doc_register
         SET gdr_doc_status        = 'CANCELED'::accounts."GdrDocStatus",
             gdr_doc_cancel_reason = ${reason},
             gdr_doc_canceled_on   = now(),
             gdr_updated_on        = now(),
             gdr_updated_by        = ${uuidOrNull(actor)}::uuid
       WHERE gdr_id       = ${gdrId}::uuid
         AND gdr_acc_year = ${accYear}::char(9)
         AND gdr_doc_status <> 'CANCELED'::accounts."GdrDocStatus"`;
    }
    async retire(tx, gdrId, accYear, actor = 'SYSTEM') {
        return tx.$executeRaw `
      UPDATE accounts.acc_voucher_doc_register
         SET gdr_is_deleted = true,
             gdr_updated_on = now(),
             gdr_updated_by = ${uuidOrNull(actor)}::uuid
       WHERE gdr_id         = ${gdrId}::uuid
         AND gdr_acc_year   = ${accYear}::char(9)
         AND gdr_is_deleted = false`;
    }
    async reissue(tx, oldGdrId, doc, opts = {}) {
        await this.cancel(tx, oldGdrId, doc.accYear, opts.reason ?? 'Superseded by an amendment', opts.actor ?? 'SYSTEM');
        return this.write(tx, doc, opts);
    }
    async writeDetails(tx, doc, gdrId) {
        if (doc.lines.length === 0) {
            return 0;
        }
        const values = doc.lines.map(inStateRates).map((l) => client_1.Prisma.sql `(
        ${gdrId}::uuid, ${doc.voucherId}::uuid, ${l.rowNo}::int,
        ${doc.accYear}::char(9), ${doc.companyId}::uuid, ${doc.branchId}::uuid,
        -- The detail table has its own two enums, label-compatible with the
        -- register's but distinct types: a GdrTaxability cast here is a 42804.
        ${l.taxability}::accounts."VoucherDocDetailTaxability",
        ${l.supplyNature}::accounts."VoucherDocDetailSupplyNature",
        ${l.itemId ?? null}::uuid, ${l.itemCode ?? null}, ${l.itemName ?? null},
        ${l.description ?? null}, ${l.hsnCode ?? null}, ${l.unitId ?? null}::uuid,
        ${num(l.qty, 4)}::numeric, ${money(l.rate)}::numeric, ${money(l.discount)}::numeric,
        ${l.isService}, ${money(l.taxableValue)}::numeric,
        ${num(l.totalTaxRate, 2)}::numeric, ${l.taxId ?? null}::uuid,
        ${num(l.cgstRate, 2)}::numeric, ${num(l.sgstRate, 2)}::numeric,
        ${num(l.igstRate, 2)}::numeric, ${num(l.cessRate, 2)}::numeric,
        ${money(l.cgstAmount)}::numeric, ${money(l.sgstAmount)}::numeric,
        ${money(l.igstAmount)}::numeric, ${money(l.cessAmount)}::numeric,
        ${money(l.cgstAmount + l.sgstAmount + l.igstAmount + l.cessAmount)}::numeric,
        ${money(l.otherAmount)}::numeric, ${money(l.totalValue)}::numeric,
        ${money(l.billValue)}::numeric,
        ${l.taxableLedgerId ?? null}::uuid, ${l.cgstLedgerId ?? null}::uuid,
        ${l.sgstLedgerId ?? null}::uuid, ${l.igstLedgerId ?? null}::uuid,
        ${l.cessLedgerId ?? null}::uuid, ${l.itcEligibility ?? null},
        ${uuidOrNull(doc.createdBy)}::uuid
      )`);
        return tx.$executeRaw `
      INSERT INTO accounts.acc_voucher_doc_detail (
        vtx_gdr_id, vtx_voucher_id, vtx_row_no,
        vtx_acc_year, vtx_company_id, vtx_branch_id,
        vtx_taxability, vtx_supply_nature,
        vtx_item_id, vtx_item_code, vtx_item_name,
        vtx_item_description, vtx_hsn_code, vtx_unit_id,
        vtx_item_qty, vtx_item_rate, vtx_item_discount,
        vtx_is_service, vtx_taxable_value,
        vtx_total_tax_rate, vtx_tax_id,
        vtx_cgst_rate, vtx_sgst_rate, vtx_igst_rate, vtx_cess_rate,
        vtx_cgst_amount, vtx_sgst_amount, vtx_igst_amount, vtx_cess_amount,
        vtx_total_tax_amount, vtx_other_amount, vtx_total_value,
        vtx_bill_value,
        vtx_taxable_ledger_id, vtx_cgst_ledger_id, vtx_sgst_ledger_id, vtx_igst_ledger_id,
        vtx_cess_ledger_id, vtx_itc_eligibility,
        vtx_created_by
      )
      VALUES ${client_1.Prisma.join(values)}`;
    }
};
exports.DocRegisterService = DocRegisterService;
exports.DocRegisterService = DocRegisterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        statutory_service_1.StatutoryService])
], DocRegisterService);
function inStateRates(l) {
    return l.supplyNature === 'INTER_STATE'
        ? { ...l, cgstRate: 0, sgstRate: 0 }
        : { ...l, igstRate: 0 };
}
function money(v) {
    return num(v, 2);
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuidOrNull(v) {
    return v && UUID.test(v) && v !== '00000000-0000-0000-0000-000000000000' ? v : null;
}
function num(v, decimals) {
    const f = Math.pow(10, decimals);
    return (Math.round((v + Number.EPSILON * Math.sign(v || 1)) * f) / f).toFixed(decimals);
}
//# sourceMappingURL=doc-register.service.js.map