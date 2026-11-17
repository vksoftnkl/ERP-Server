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
exports.DC_PRINT_PROVIDERS = exports.DcrItemsProvider = exports.DcrHeaderProvider = exports.DcItemsProvider = exports.DcHeaderProvider = exports.DcPrintSource = void 0;
exports.dashDate = dashDate;
exports.dashInstant = dashInstant;
exports.purposeText = purposeText;
exports.dcLineRows = dcLineRows;
exports.dcHeadRow = dcHeadRow;
exports.dcrLineRows = dcrLineRows;
exports.dcrHeadRow = dcrHeadRow;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../../../database/prisma/prisma.service");
const rights_1 = require("../../../../../common/posting/rights");
const sales_doc_utils_1 = require("../../../../sales/posting/sales-doc.utils");
const provider_utils_1 = require("./provider.utils");
const print_text_utils_1 = require("./print-text.utils");
const Z = new client_1.Prisma.Decimal(0);
const money = (v) => (0, print_text_utils_1.numOf)((0, print_text_utils_1.decOf)(v)) ?? 0;
function isoDay(value) {
    if (!value)
        return null;
    const iso = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}
function dashDate(value) {
    const iso = isoDay(value);
    return iso ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}` : '';
}
function dashInstant(at) {
    return (0, print_text_utils_1.istText)(at).replace(/\//g, '-');
}
const blank = (v) => (v ?? '').trim();
function purposeText(purpose) {
    return blank(purpose)
        .toLowerCase()
        .split('_')
        .filter(Boolean)
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(' ');
}
const CONDITION_TEXT = {
    RESTOCK: 'Restock',
    DAMAGED: 'Damaged',
    EXPIRED: 'Expired',
    SCRAP: 'Scrap',
};
const BUCKET_TEXT = {
    SALEABLE: 'Saleable',
    DAMAGED: 'Damaged',
    EXPIRED: 'Expired',
    QUARANTINE: 'Quarantine',
};
const MODE_TEXT = {
    ROAD: 'By road',
    RAIL: 'By rail',
    AIR: 'By air',
    SHIP: 'By ship',
};
function stateText(name, code) {
    const n = blank(name);
    const c = blank(code);
    return n && c ? `${n} (${c})` : n || (c ? `(${c})` : '');
}
function companyFields(h) {
    return {
        company_name: h.comp_name ?? '',
        company_legal_name: h.comp_legal_name ?? '',
        company_addr1: h.comp_addr1 ?? '',
        company_addr2: h.comp_addr2 ?? '',
        company_addr3: h.comp_addr3 ?? '',
        company_city: h.comp_city ?? '',
        company_state: h.comp_state ?? h.comp_state_by_code ?? '',
        company_state_code: blank(h.comp_state_code),
        company_pin: h.comp_pin ?? '',
        company_gstin: h.comp_gstin_no ?? '',
        company_phone: h.comp_phone ?? '',
        company_email: h.comp_mail ?? '',
        branch_name: h.br_name ?? '',
        branch_gstin: h.br_gstin_no ?? '',
    };
}
function moveFields(h) {
    const vehicle = blank(h.vehicle_no);
    const driver = blank(h.driver_name);
    const transporter = blank(h.ttd_transporter_name);
    const tGstin = blank(h.ttd_transporter_gstin);
    const lr = blank(h.ttd_lr_no);
    const lrDate = dashDate(h.ttd_lr_date);
    const mode = blank(h.ttd_transport_mode).toUpperCase();
    const km = h.ttd_distance_km !== null && h.ttd_distance_km !== undefined && Number(h.ttd_distance_km) > 0
        ? Number(h.ttd_distance_km)
        : null;
    const transport = [
        vehicle ? `Vehicle ${vehicle}` : null,
        driver ? `Driver ${driver}` : null,
        mode ? (MODE_TEXT[mode] ?? purposeText(mode)) : null,
        transporter ? `Transporter ${transporter}${tGstin ? ` (${tGstin})` : ''}` : null,
        lr ? `LR ${lr}${lrDate ? ` dt ${lrDate}` : ''}` : null,
        km !== null ? `${km} km` : null,
    ].filter(Boolean);
    const loadmen = blank(h.loadman_names);
    const supervisor = blank(h.supervisor_name);
    const crew = [
        loadmen ? `Loadmen: ${loadmen}` : null,
        supervisor ? `Supervisor: ${supervisor}` : null,
    ].filter(Boolean);
    const ewb = blank(h.gdw_no);
    const ewbDate = h.gdw_generated_on ? dashInstant(h.gdw_generated_on).slice(0, 10) : '';
    return {
        vehicle_no: vehicle,
        driver_name: driver,
        supervisor_name: supervisor,
        loadman_names: loadmen,
        salesman_names: blank(h.salesman_names),
        crew_text: crew.join(' · '),
        transport_mode: mode,
        transporter_name: transporter,
        transporter_gstin: tGstin,
        lr_no: lr,
        lr_date_text: lrDate,
        distance_km: km,
        transport_text: transport.length > 0 ? transport.join(' · ') : '-',
        ewb_no: ewb,
        ewb_status: ewb ? blank(h.gdw_status) : '',
        ewb_date_text: ewb ? ewbDate : '',
        ewb_valid_text: ewb && h.gdw_valid_upto ? `valid till ${dashInstant(h.gdw_valid_upto)}` : '',
        ewb_text: ewb ? `${ewb}${ewbDate ? ` dt ${ewbDate}` : ''}` : '',
    };
}
function statusMark(status) {
    const s = blank(status).toUpperCase();
    return s === 'DRAFT' ? 'DRAFT' : s === 'CANCELLED' ? 'CANCELLED' : '';
}
function printFields(f, printCount) {
    const printedAt = dashInstant(f.at);
    return {
        print_count: printCount,
        is_reprint: printCount > 0,
        reprint_mark: printCount > 0
            ? `REPRINT (printed ${printCount} time${printCount === 1 ? '' : 's'} before)`
            : '',
        prepared_by: f.preparedBy ?? '',
        prepared_line: f.preparedBy ? `Prepared by ${f.preparedBy}` : '',
        printed_at: printedAt,
        printed_by: f.printedBy ?? '',
        printed_line: [`Printed ${printedAt}`, f.printedBy].filter(Boolean).join(' · '),
    };
}
function lineKg(weight, pkgs, unitKg) {
    const w = (0, print_text_utils_1.decOf)(weight);
    return w.greaterThan(0) ? w : pkgs.times((0, print_text_utils_1.decOf)(unitKg));
}
function itemName(en, ta, tamil) {
    return (tamil ? blank(ta) || blank(en) : blank(en)) || '';
}
function dcLineRows(lines, tamil = false) {
    return lines.map((l, i) => {
        const qty = (0, print_text_utils_1.decOf)(l.sdi_dc_qty);
        const free = (0, print_text_utils_1.decOf)(l.sdi_free_qty);
        const pkgs = qty.plus(free);
        const kg = lineKg(l.sdi_weight_qty, pkgs, l.unit_kg);
        const isFree = l.sdi_is_free === true;
        const name = itemName(l.item_name_en, l.item_name_ta, tamil);
        const batch = blank(l.sdi_batch_no) || blank(l.lot_no);
        return {
            sl_no: i + 1,
            line_no: l.sdi_line_no,
            split_no: l.sdi_split_no ?? 1,
            item_id: l.sdi_item_id,
            item_code: l.item_code ?? '',
            item_name: name,
            hsn_code: blank(l.hsn_code),
            batch_no: blank(l.sdi_batch_no),
            lot_no: blank(l.lot_no),
            godown_name: l.godown_name ?? '',
            unit_name: l.unit_name ?? '',
            unit_code: l.unit_code ?? '',
            qty: (0, print_text_utils_1.numOf)(qty),
            qty_text: (0, print_text_utils_1.qtyText)(qty),
            free_qty: (0, print_text_utils_1.numOf)(free),
            free_qty_text: free.isZero() ? '' : (0, print_text_utils_1.qtyText)(free),
            pkgs: (0, print_text_utils_1.numOf)(pkgs),
            pkgs_text: (0, print_text_utils_1.qtyText)(pkgs),
            is_free: isFree,
            free_type: isFree ? blank(l.sdi_free_type) : '',
            free_mark: isFree ? 'FREE' : '',
            description: name +
                (batch ? ` · ${batch}` : '') +
                (free.greaterThan(0) ? ` + ${(0, print_text_utils_1.qtyText)(free)} free` : '') +
                (isFree ? ' (FREE)' : ''),
            rate: money(l.sdi_rate),
            rate_pre_tax: money(l.sdi_rate_pre_tax),
            disc_amt: money(l.sdi_disc_amt),
            gross_amt: money(l.sdi_gross_amt),
            taxable_amt: money(l.sdi_taxable_amt),
            tax_perc: money(l.sdi_tax_perc),
            cgst_perc: money(l.sdi_cgst_perc),
            cgst_amt: money(l.sdi_cgst_amt),
            sgst_perc: money(l.sdi_sgst_perc),
            sgst_amt: money(l.sdi_sgst_amt),
            igst_perc: money(l.sdi_igst_perc),
            igst_amt: money(l.sdi_igst_amt),
            cess_perc: money(l.sdi_cess_perc),
            cess_amt: money(l.sdi_cess_amt),
            tax_amt: money(l.sdi_tax_amt),
            net_amt: money(l.sdi_net_amt),
            weight_kg: (0, print_text_utils_1.numOf)(kg),
            weight_text: kg.isZero() ? '' : (0, print_text_utils_1.qtyText)(kg),
            remarks: l.sdi_remarks ?? '',
            src_doc_type: l.sdi_src_doc_type ?? '',
            src_doc_refno: l.sdi_src_doc_refno ?? '',
        };
    });
}
function sums(rows, qtyKey) {
    const qty = rows.reduce((a, r) => a.plus((0, print_text_utils_1.decOf)(r[qtyKey])), Z);
    const kg = rows.reduce((a, r) => a.plus((0, print_text_utils_1.decOf)(r.weight_kg)), Z);
    const free = rows.filter((r) => r.is_free === true).length;
    return { qty, kg, free };
}
function dcHeadRow(h, lines, f) {
    const { qty: pkgs, kg, free } = sums(lines, 'pkgs');
    const pos = blank(h.sdc_pos_stcd);
    const compCode = blank(h.comp_state_code);
    const toParts = [
        blank(h.ttd_to_name),
        blank(h.ttd_to_addr),
        [blank(h.ttd_to_place), blank(h.ttd_to_pin)].filter(Boolean).join(' '),
    ].filter(Boolean);
    const toGodown = blank(h.ttd_to_godown_name);
    const orderRefs = [
        ...new Set((blank(h.sdc_src_doc_refno) && blank(h.sdc_src_doc_type) === 'SALES_ORDER'
            ? [blank(h.sdc_src_doc_refno)]
            : []).concat(lines
            .filter((l) => l.src_doc_type === 'SALES_ORDER' && blank(l.src_doc_refno))
            .map((l) => blank(l.src_doc_refno)))),
    ];
    const srcDate = dashDate(h.sdc_src_doc_date);
    const usrRef = blank(h.sdc_usr_refno);
    const usrDate = dashDate(h.sdc_usr_refdate);
    const printCount = Number(h.sdc_print_count ?? 0);
    return {
        title: 'DELIVERY CHALLAN',
        ...companyFields(h),
        dc_id: h.sdc_id,
        acc_year: blank(h.sdc_acc_year),
        refno: h.sdc_dc_refno ?? '',
        dc_date: isoDay(h.sdc_dc_date),
        dc_date_text: dashDate(h.sdc_dc_date),
        purpose: blank(h.sdc_purpose),
        purpose_text: purposeText(h.sdc_purpose),
        status: h.sdc_status,
        status_mark: statusMark(h.sdc_status),
        src_doc_type: blank(h.sdc_src_doc_type),
        src_doc_refno: blank(h.sdc_src_doc_refno),
        src_doc_date_text: srcDate,
        order_ref_text: orderRefs.length === 1 && srcDate && orderRefs[0] === blank(h.sdc_src_doc_refno)
            ? `${orderRefs[0]} dt ${srcDate}`
            : orderRefs.join(', '),
        usr_refno: usrRef,
        usr_refdate_text: usrDate,
        their_ref_text: usrRef ? `${usrRef}${usrDate ? ` dt ${usrDate}` : ''}` : '',
        cust_name: h.sdc_cust_name ?? '',
        cust_addr: h.sdc_cust_addr ?? '',
        cust_place: h.sdc_cust_place ?? '',
        cust_pin: h.sdc_cust_pin ?? '',
        cust_place_text: [blank(h.sdc_cust_place), blank(h.sdc_cust_pin)].filter(Boolean).join(' - '),
        cust_phone: blank(h.sdc_cust_phone),
        cust_gstin: blank(h.sdc_cust_gstin),
        cust_gst_type: blank(h.sdc_cust_gst_type),
        cust_state_code: blank(h.sdc_cust_stcd),
        cust_state_name: blank(h.sdc_state_name) || blank(h.cust_state_by_code),
        cust_state_text: stateText(blank(h.sdc_state_name) || h.cust_state_by_code, h.sdc_cust_stcd),
        pos_state_code: pos,
        pos_state_name: pos ? blank(h.pos_state_name) : '',
        pos_text: pos
            ? stateText(h.pos_state_name, pos)
            : stateText(h.comp_state_by_code ?? h.comp_state, compCode),
        pos_from_company: !pos && !!compCode,
        is_interstate: (0, sales_doc_utils_1.supplyNatureOf)(compCode, pos) === 'INTER',
        ship_to_text: toParts.length > 0
            ? toParts.join(', ')
            : toGodown
                ? `${toGodown} godown`
                : 'Same as consignee',
        ...moveFields(h),
        lines_count: lines.length,
        pkgs: (0, print_text_utils_1.numOf)(pkgs),
        pkgs_text: (0, print_text_utils_1.qtyText)(pkgs),
        weight_kg: (0, print_text_utils_1.numOf)(kg),
        weight_text: (0, print_text_utils_1.qtyText)(kg),
        free_lines: free,
        totals_text: [
            (0, print_text_utils_1.countText)(lines.length, 'line'),
            `${(0, print_text_utils_1.qtyText)(pkgs)} pkgs`,
            kg.isZero() ? null : `${(0, print_text_utils_1.qtyText)(kg)} kg`,
            free > 0 ? `${free} free` : null,
        ]
            .filter(Boolean)
            .join(' · '),
        gross_amt: money(h.sdc_gross_amt),
        disc_amt: money(h.sdc_disc_amt),
        taxable_amt: money(h.sdc_taxable_amt),
        cgst_amt: money(h.sdc_cgst_amt),
        sgst_amt: money(h.sdc_sgst_amt),
        igst_amt: money(h.sdc_igst_amt),
        cess_amt: money(h.sdc_cess_amt),
        tax_amt: money(h.sdc_tax_amt),
        round_off: money(h.sdc_round_off),
        dc_amt: money(h.sdc_dc_amt),
        remarks: blank(h.sdc_remarks),
        ...printFields(f, printCount),
    };
}
function dcrLineRows(lines, tamil = false) {
    return lines.map((l, i) => {
        const qty = (0, print_text_utils_1.decOf)(l.sdri_return_qty);
        const kg = lineKg(l.sdri_weight_qty, qty.plus((0, print_text_utils_1.decOf)(l.sdri_free_qty)), l.unit_kg);
        const isFree = l.is_free === true;
        const name = itemName(l.item_name_en, l.item_name_ta, tamil);
        const batch = blank(l.sdri_batch_no) || blank(l.lot_no);
        const condition = blank(l.sdri_condition).toUpperCase();
        const bucket = blank(l.sdri_bucket).toUpperCase();
        const conditionText = CONDITION_TEXT[condition] ?? purposeText(condition);
        const bucketText = BUCKET_TEXT[bucket] ?? purposeText(bucket);
        return {
            sl_no: i + 1,
            line_no: l.sdri_line_no,
            dc_line_no: l.sdri_dc_line_no,
            item_id: l.sdri_item_id,
            item_code: l.item_code ?? '',
            item_name: name,
            hsn_code: blank(l.hsn_code),
            batch_no: blank(l.sdri_batch_no),
            lot_no: blank(l.lot_no),
            godown_name: l.godown_name ?? '',
            unit_name: l.unit_name ?? '',
            unit_code: l.unit_code ?? '',
            qty: (0, print_text_utils_1.numOf)(qty),
            qty_text: (0, print_text_utils_1.qtyText)(qty),
            condition,
            condition_text: conditionText,
            bucket,
            bucket_text: bucketText,
            condition_bucket_text: bucketText && bucketText !== conditionText
                ? `${conditionText} → ${bucketText}`
                : conditionText,
            is_free: isFree,
            free_type: isFree ? blank(l.free_type) : '',
            free_mark: isFree ? 'FREE' : '',
            description: name + (batch ? ` · ${batch}` : '') + (isFree ? ' (FREE)' : ''),
            rate: money(l.sdri_rate),
            rate_pre_tax: money(l.sdri_rate_pre_tax),
            gross_amt: money(l.sdri_gross_amt),
            taxable_amt: money(l.sdri_taxable_amt),
            tax_perc: money(l.sdri_tax_perc),
            cgst_perc: money(l.sdri_cgst_perc),
            cgst_amt: money(l.sdri_cgst_amt),
            sgst_perc: money(l.sdri_sgst_perc),
            sgst_amt: money(l.sdri_sgst_amt),
            igst_perc: money(l.sdri_igst_perc),
            igst_amt: money(l.sdri_igst_amt),
            cess_perc: money(l.sdri_cess_perc),
            cess_amt: money(l.sdri_cess_amt),
            tax_amt: money(l.sdri_tax_amt),
            net_amt: money(l.sdri_net_amt),
            weight_kg: (0, print_text_utils_1.numOf)(kg),
            weight_text: kg.isZero() ? '' : (0, print_text_utils_1.qtyText)(kg),
            remarks: l.sdri_remarks ?? '',
        };
    });
}
function dcrHeadRow(h, lines, f) {
    const { qty, kg, free } = sums(lines, 'qty');
    const pos = blank(h.sdr_pos_stcd);
    const compCode = blank(h.comp_state_code);
    const godowns = [...new Set(lines.map((l) => blank(l.godown_name)).filter(Boolean))];
    const dcDate = dashDate(h.sdr_dc_date);
    const reason = blank(h.reason_name);
    const reasonMore = blank(h.sdr_return_reason);
    const add = (key) => lines.reduce((a, l) => a.plus((0, print_text_utils_1.decOf)(l[key])), Z);
    const usrRef = blank(h.sdr_usr_refno);
    const usrDate = dashDate(h.sdr_usr_refdate);
    const printCount = Number(h.sdr_print_count ?? 0);
    return {
        title: 'CHALLAN RETURN',
        ...companyFields(h),
        return_id: h.sdr_id,
        acc_year: blank(h.sdr_acc_year),
        refno: h.sdr_return_refno ?? '',
        return_date: isoDay(h.sdr_return_date),
        return_date_text: dashDate(h.sdr_return_date),
        status: h.sdr_status,
        status_mark: statusMark(h.sdr_status),
        dc_refno: blank(h.sdr_dc_refno),
        dc_date_text: dcDate,
        dc_text: `${blank(h.sdr_dc_refno)}${dcDate ? ` dt ${dcDate}` : ''}`,
        dc_purpose: blank(h.sdc_purpose),
        dc_purpose_text: purposeText(h.sdc_purpose),
        reason_code: blank(h.reason_code),
        reason_name: reason,
        reason_text: reason && reasonMore && reasonMore !== reason
            ? `${reason}: ${reasonMore}`
            : reason || reasonMore,
        usr_refno: usrRef,
        their_ref_text: usrRef ? `${usrRef}${usrDate ? ` dt ${usrDate}` : ''}` : '',
        cust_name: h.sdr_cust_name ?? '',
        cust_addr: h.sdc_cust_addr ?? '',
        cust_place: h.sdc_cust_place ?? '',
        cust_pin: h.sdc_cust_pin ?? '',
        cust_place_text: [blank(h.sdc_cust_place), blank(h.sdc_cust_pin)].filter(Boolean).join(' - '),
        cust_phone: blank(h.sdc_cust_phone),
        cust_gstin: blank(h.sdr_cust_gstin),
        cust_gst_type: blank(h.sdc_cust_gst_type),
        cust_state_code: blank(h.sdr_cust_stcd),
        cust_state_name: blank(h.sdc_state_name) || blank(h.cust_state_by_code),
        cust_state_text: stateText(blank(h.sdc_state_name) || h.cust_state_by_code, h.sdr_cust_stcd),
        pos_state_code: pos,
        pos_state_name: pos ? blank(h.pos_state_name) : '',
        pos_text: pos
            ? stateText(h.pos_state_name, pos)
            : stateText(h.comp_state_by_code ?? h.comp_state, compCode),
        pos_from_company: !pos && !!compCode,
        is_interstate: (0, sales_doc_utils_1.supplyNatureOf)(compCode, pos) === 'INTER',
        godown_text: godowns.length === 0 ? '' : godowns.join(', '),
        ...moveFields(h),
        lines_count: lines.length,
        qty: (0, print_text_utils_1.numOf)(qty),
        qty_text: (0, print_text_utils_1.qtyText)(qty),
        weight_kg: (0, print_text_utils_1.numOf)(kg),
        weight_text: (0, print_text_utils_1.qtyText)(kg),
        free_lines: free,
        totals_text: [
            (0, print_text_utils_1.countText)(lines.length, 'line'),
            `${(0, print_text_utils_1.qtyText)(qty)} back`,
            kg.isZero() ? null : `${(0, print_text_utils_1.qtyText)(kg)} kg`,
            free > 0 ? `${free} free` : null,
        ]
            .filter(Boolean)
            .join(' · '),
        taxable_amt: money(h.sdr_taxable_amt),
        cgst_amt: (0, print_text_utils_1.numOf)(add('cgst_amt')) ?? 0,
        sgst_amt: (0, print_text_utils_1.numOf)(add('sgst_amt')) ?? 0,
        igst_amt: (0, print_text_utils_1.numOf)(add('igst_amt')) ?? 0,
        cess_amt: (0, print_text_utils_1.numOf)(add('cess_amt')) ?? 0,
        tax_amt: money(h.sdr_tax_amt),
        return_amt: money(h.sdr_return_amt),
        remarks: blank(h.sdr_remarks),
        ...printFields(f, printCount),
    };
}
let DcPrintSource = class DcPrintSource {
    prisma;
    dc = new print_text_utils_1.RenderMemo(0);
    dcr = new print_text_utils_1.RenderMemo(0);
    constructor(prisma) {
        this.prisma = prisma;
    }
    get db() {
        return this.prisma;
    }
    async printRights(userId, menuId, what) {
        const rights = userId && print_text_utils_1.UUID.test(userId)
            ? await (0, rights_1.loadRights)(this.prisma, userId, menuId)
            : { ...rights_1.NO_RIGHTS };
        for (const right of ['view', 'print']) {
            if (!rights[right]) {
                throw new Error(`This user may not print ${what} (menu ${menuId}: um_can_${right} is not granted).`);
            }
        }
    }
    async userName(idOrText) {
        const v = blank(idOrText);
        if (!v)
            return null;
        if (!print_text_utils_1.UUID.test(v))
            return v;
        const [user] = await this.db.$queryRaw `
      SELECT COALESCE(NULLIF(btrim(usr_display_name), ''), usr_login_name) AS name
        FROM public.user_master WHERE usr_id = ${v}::uuid`;
        return user?.name ?? null;
    }
    async challan(request, code) {
        const { docId, accYear } = (0, provider_utils_1.requireDocument)(request, code);
        const { companyId, userId } = request.context;
        const tamil = request.lang.toLowerCase().startsWith('ta');
        return this.dc.get(`${companyId}|${docId}|${accYear}|${userId ?? ''}|${tamil}`, async () => {
            await this.printRights(userId, sales_doc_utils_1.SALES_MENU_ID.DELIVERY_CHALLAN, 'delivery challans');
            const [h] = await this.db.$queryRaw `
        SELECT d.sdc_id, d.sdc_acc_year, d.sdc_branch_id, d.sdc_dc_refno, d.sdc_dc_date, d.sdc_purpose, d.sdc_status,
               d.sdc_print_count, d.sdc_src_doc_type, d.sdc_src_doc_refno, d.sdc_src_doc_date, d.sdc_usr_refno,
               d.sdc_usr_refdate, d.sdc_cust_name, d.sdc_cust_addr, d.sdc_cust_place, d.sdc_cust_pin, d.sdc_cust_phone,
               d.sdc_cust_gstin, d.sdc_cust_gst_type, d.sdc_cust_stcd, d.sdc_pos_stcd, d.sdc_state_name,
               COALESCE(NULLIF(btrim(d.sdc_vehicle_no), ''), veh.veh_vehicle_no) AS vehicle_no,
               drv.emp_name AS driver_name, sup.emp_name AS supervisor_name,
               (SELECT string_agg(e.emp_name, ', ' ORDER BY array_position(d.sdc_loadman_id, e.emp_id))
                  FROM public.employee_master e WHERE e.emp_id = ANY(d.sdc_loadman_id)) AS loadman_names,
               (SELECT string_agg(e.emp_name, ', ' ORDER BY array_position(d.sdc_salesman_id, e.emp_id))
                  FROM public.employee_master e WHERE e.emp_id = ANY(d.sdc_salesman_id)) AS salesman_names,
               d.sdc_gross_amt, d.sdc_disc_amt, d.sdc_taxable_amt, d.sdc_cgst_amt, d.sdc_sgst_amt, d.sdc_igst_amt,
               d.sdc_cess_amt, d.sdc_tax_amt, d.sdc_round_off, d.sdc_dc_amt, d.sdc_remarks, d.sdc_created_by,
               c.comp_name, c.comp_legal_name, c.comp_addr1, c.comp_addr2, c.comp_addr3, c.comp_city, c.comp_state,
               c.comp_state_code, c.comp_pin, c.comp_gstin_no, c.comp_phone, c.comp_mail,
               b.br_name, b.br_gstin_no,
               (SELECT s.state_name FROM fixed.state_codes s WHERE btrim(s.state_code) = btrim(d.sdc_cust_stcd)
                 ORDER BY s.is_deleted, s.is_active DESC LIMIT 1) AS cust_state_by_code,
               (SELECT s.state_name FROM fixed.state_codes s WHERE btrim(s.state_code) = btrim(d.sdc_pos_stcd)
                 ORDER BY s.is_deleted, s.is_active DESC LIMIT 1) AS pos_state_name,
               (SELECT s.state_name FROM fixed.state_codes s WHERE btrim(s.state_code) = btrim(c.comp_state_code)
                 ORDER BY s.is_deleted, s.is_active DESC LIMIT 1) AS comp_state_by_code,
               t.ttd_transport_mode, t.ttd_transporter_name, t.ttd_transporter_gstin, t.ttd_lr_no, t.ttd_lr_date,
               t.ttd_distance_km, t.ttd_to_name, t.ttd_to_addr, t.ttd_to_place, t.ttd_to_pin,
               tg.gdl_name AS ttd_to_godown_name,
               ewb.gdw_no, ewb.gdw_status, ewb.gdw_generated_on, ewb.gdw_valid_upto
          FROM sales.sale_dc d
          JOIN public.companys c ON c.comp_id = d.sdc_company_id
          LEFT JOIN public.branch_master b ON b.br_id = d.sdc_branch_id
          LEFT JOIN public.vehicle_master veh ON veh.veh_id = d.sdc_vehicle_id
          LEFT JOIN public.employee_master drv ON drv.emp_id = d.sdc_driver_id
          LEFT JOIN public.employee_master sup ON sup.emp_id = d.sdc_supervisor_id
          LEFT JOIN public.txn_transport_detail t
                 ON t.ttd_doc_type = 'DELIVERY_CHALLAN' AND t.ttd_doc_id = d.sdc_id
                AND t.ttd_acc_year = d.sdc_acc_year AND t.ttd_is_deleted = false
          LEFT JOIN inventory.godown_locations tg ON tg.gdl_id = t.ttd_to_godown_id
          LEFT JOIN LATERAL (
                SELECT w.gdw_no, w.gdw_status::text AS gdw_status, w.gdw_generated_on,
                       COALESCE(w.gdw_extended_upto, w.gdw_valid_upto) AS gdw_valid_upto
                  FROM accounts.acc_voucher_doc_register g
                  JOIN accounts.acc_voucher_doc_ewaybill w
                    ON w.gdw_gdr_id = g.gdr_id AND w.gdw_acc_year = g.gdr_acc_year AND w.gdw_is_deleted = false
                 WHERE g.gdr_source_doc_id = d.sdc_id AND g.gdr_acc_year = d.sdc_acc_year
                   AND g.gdr_is_deleted = false
                   AND w.gdw_status IN ('GENERATED', 'EXPIRED') AND w.gdw_no IS NOT NULL
                 ORDER BY (g.gdr_doc_status <> 'CANCELED') DESC, w.gdw_generated_on DESC NULLS LAST
                 LIMIT 1) ewb ON true
         WHERE d.sdc_id = ${docId}::uuid
           -- The partition key: sale_dc is PARTITIONED BY sdc_acc_year.
           AND d.sdc_acc_year = ${accYear}::bpchar
           AND d.sdc_company_id = ${companyId}::uuid
           AND d.sdc_is_deleted = false`;
            if (!h) {
                throw new Error(`No delivery challan ${docId} in this company for ${accYear}.`);
            }
            const raw = await this.db.$queryRaw `
        SELECT i.sdi_line_no, i.sdi_split_no, i.sdi_item_id, itm.item_code, itm.item_name_en, itm.item_name_ta,
               COALESCE(NULLIF(btrim(i.sdi_hsn_code), ''), itm.item_hsn_code) AS hsn_code,
               i.sdi_batch_no, lot.slt_batch_no AS lot_no, gd.gdl_name AS godown_name,
               unt.unit_name, unt.unit_code, iuc.iuc_uom_weight AS unit_kg,
               i.sdi_dc_qty, i.sdi_free_qty, i.sdi_weight_qty, i.sdi_is_free, i.sdi_free_type,
               i.sdi_src_doc_type, i.sdi_src_doc_refno,
               i.sdi_rate, i.sdi_rate_pre_tax, i.sdi_disc_amt, i.sdi_gross_amt, i.sdi_taxable_amt,
               i.sdi_tax_perc, i.sdi_cgst_perc, i.sdi_cgst_amt, i.sdi_sgst_perc, i.sdi_sgst_amt,
               i.sdi_igst_perc, i.sdi_igst_amt, i.sdi_cess_perc, i.sdi_cess_amt, i.sdi_tax_amt, i.sdi_net_amt,
               i.sdi_remarks
          FROM sales.sale_dc_item i
          JOIN inventory.item_master itm ON itm.item_id = i.sdi_item_id
          LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = i.sdi_item_unit_id
          LEFT JOIN inventory.item_unit_master unt ON unt.unit_id = iuc.iuc_unit_id
          LEFT JOIN inventory.godown_locations gd ON gd.gdl_id = i.sdi_godown_id
          LEFT JOIN stock.stock_lot lot ON lot.slt_id = i.sdi_lot_id
         WHERE i.sdi_dc_id = ${docId}::uuid
           AND i.sdi_acc_year = ${accYear}::bpchar
           AND i.sdi_company_id = ${companyId}::uuid
           AND i.sdi_is_deleted = false
         ORDER BY i.sdi_line_no, i.sdi_split_no`;
            const lines = dcLineRows(raw, tamil);
            const [preparedBy, printedBy] = await Promise.all([
                this.userName(h.sdc_created_by),
                this.userName(userId),
            ]);
            return { head: dcHeadRow(h, lines, { preparedBy, printedBy, at: new Date() }), lines };
        });
    }
    async dcReturn(request, code) {
        const { docId, accYear } = (0, provider_utils_1.requireDocument)(request, code);
        const { companyId, userId } = request.context;
        const tamil = request.lang.toLowerCase().startsWith('ta');
        return this.dcr.get(`${companyId}|${docId}|${accYear}|${userId ?? ''}|${tamil}`, async () => {
            await this.printRights(userId, sales_doc_utils_1.SALES_MENU_ID.DC_RETURN, 'challan returns');
            const [h] = await this.db.$queryRaw `
        SELECT r.sdr_id, r.sdr_acc_year, r.sdr_branch_id, r.sdr_return_refno, r.sdr_return_date, r.sdr_status,
               r.sdr_print_count, r.sdr_dc_refno, r.sdr_dc_date, r.sdr_return_reason, r.sdr_usr_refno,
               r.sdr_usr_refdate, r.sdr_cust_name, r.sdr_cust_gstin, r.sdr_cust_stcd, r.sdr_pos_stcd,
               dc.sdc_cust_addr, dc.sdc_cust_place, dc.sdc_cust_pin, dc.sdc_cust_phone, dc.sdc_cust_gst_type,
               dc.sdc_state_name, dc.sdc_purpose,
               rsn.srm_code AS reason_code, rsn.srm_name AS reason_name,
               COALESCE(NULLIF(btrim(r.sdr_vehicle_no), ''), veh.veh_vehicle_no) AS vehicle_no,
               drv.emp_name AS driver_name, sup.emp_name AS supervisor_name,
               (SELECT string_agg(e.emp_name, ', ' ORDER BY array_position(r.sdr_loadman_id, e.emp_id))
                  FROM public.employee_master e WHERE e.emp_id = ANY(r.sdr_loadman_id)) AS loadman_names,
               (SELECT string_agg(e.emp_name, ', ' ORDER BY array_position(r.sdr_salesman_id, e.emp_id))
                  FROM public.employee_master e WHERE e.emp_id = ANY(r.sdr_salesman_id)) AS salesman_names,
               r.sdr_taxable_amt, r.sdr_tax_amt, r.sdr_return_amt, r.sdr_remarks, r.sdr_created_by,
               c.comp_name, c.comp_legal_name, c.comp_addr1, c.comp_addr2, c.comp_addr3, c.comp_city, c.comp_state,
               c.comp_state_code, c.comp_pin, c.comp_gstin_no, c.comp_phone, c.comp_mail,
               b.br_name, b.br_gstin_no,
               (SELECT s.state_name FROM fixed.state_codes s WHERE btrim(s.state_code) = btrim(r.sdr_cust_stcd)
                 ORDER BY s.is_deleted, s.is_active DESC LIMIT 1) AS cust_state_by_code,
               (SELECT s.state_name FROM fixed.state_codes s WHERE btrim(s.state_code) = btrim(r.sdr_pos_stcd)
                 ORDER BY s.is_deleted, s.is_active DESC LIMIT 1) AS pos_state_name,
               (SELECT s.state_name FROM fixed.state_codes s WHERE btrim(s.state_code) = btrim(c.comp_state_code)
                 ORDER BY s.is_deleted, s.is_active DESC LIMIT 1) AS comp_state_by_code,
               t.ttd_transport_mode, t.ttd_transporter_name, t.ttd_transporter_gstin, t.ttd_lr_no, t.ttd_lr_date,
               t.ttd_distance_km,
               ewb.gdw_no, ewb.gdw_status, ewb.gdw_generated_on, ewb.gdw_valid_upto
          FROM sales.sale_dc_return r
          JOIN public.companys c ON c.comp_id = r.sdr_company_id
          LEFT JOIN public.branch_master b ON b.br_id = r.sdr_branch_id
          -- The challan it returns, by its own partition key: the address and purpose.
          LEFT JOIN sales.sale_dc dc ON dc.sdc_id = r.sdr_dc_id AND dc.sdc_acc_year = r.sdr_dc_acc_year
          LEFT JOIN stock.stock_reason_master rsn ON rsn.srm_id = r.sdr_reason_id
          LEFT JOIN public.vehicle_master veh ON veh.veh_id = r.sdr_vehicle_id
          LEFT JOIN public.employee_master drv ON drv.emp_id = r.sdr_driver_id
          LEFT JOIN public.employee_master sup ON sup.emp_id = r.sdr_supervisor_id
          LEFT JOIN public.txn_transport_detail t
                 ON t.ttd_doc_type = 'DC_RETURN' AND t.ttd_doc_id = r.sdr_id
                AND t.ttd_acc_year = r.sdr_acc_year AND t.ttd_is_deleted = false
          LEFT JOIN LATERAL (
                SELECT w.gdw_no, w.gdw_status::text AS gdw_status, w.gdw_generated_on,
                       COALESCE(w.gdw_extended_upto, w.gdw_valid_upto) AS gdw_valid_upto
                  FROM accounts.acc_voucher_doc_register g
                  JOIN accounts.acc_voucher_doc_ewaybill w
                    ON w.gdw_gdr_id = g.gdr_id AND w.gdw_acc_year = g.gdr_acc_year AND w.gdw_is_deleted = false
                 WHERE g.gdr_source_doc_id = r.sdr_id AND g.gdr_acc_year = r.sdr_acc_year
                   AND g.gdr_is_deleted = false
                   AND w.gdw_status IN ('GENERATED', 'EXPIRED') AND w.gdw_no IS NOT NULL
                 ORDER BY (g.gdr_doc_status <> 'CANCELED') DESC, w.gdw_generated_on DESC NULLS LAST
                 LIMIT 1) ewb ON true
         WHERE r.sdr_id = ${docId}::uuid
           AND r.sdr_acc_year = ${accYear}::bpchar
           AND r.sdr_company_id = ${companyId}::uuid
           AND r.sdr_is_deleted = false`;
            if (!h) {
                throw new Error(`No challan return ${docId} in this company for ${accYear}.`);
            }
            const raw = await this.db.$queryRaw `
        SELECT ri.sdri_line_no, ri.sdri_dc_line_no, ri.sdri_item_id, itm.item_code, itm.item_name_en, itm.item_name_ta,
               COALESCE(NULLIF(btrim(ri.sdri_hsn_code), ''), itm.item_hsn_code) AS hsn_code,
               ri.sdri_batch_no, lot.slt_batch_no AS lot_no, gd.gdl_name AS godown_name,
               unt.unit_name, unt.unit_code, iuc.iuc_uom_weight AS unit_kg,
               ri.sdri_return_qty, ri.sdri_free_qty, ri.sdri_weight_qty, ri.sdri_condition, ri.sdri_bucket,
               COALESCE(di.sdi_is_free, false) AS is_free, di.sdi_free_type AS free_type,
               ri.sdri_rate, ri.sdri_rate_pre_tax, ri.sdri_gross_amt, ri.sdri_taxable_amt,
               ri.sdri_tax_perc, ri.sdri_cgst_perc, ri.sdri_cgst_amt, ri.sdri_sgst_perc, ri.sdri_sgst_amt,
               ri.sdri_igst_perc, ri.sdri_igst_amt, ri.sdri_cess_perc, ri.sdri_cess_amt, ri.sdri_tax_amt,
               ri.sdri_net_amt, ri.sdri_remarks
          FROM sales.sale_dc_return_item ri
          JOIN inventory.item_master itm ON itm.item_id = ri.sdri_item_id
          -- The challan line it came back from: whether it went free.
          LEFT JOIN sales.sale_dc_item di ON di.sdi_id = ri.sdri_dc_item_id AND di.sdi_acc_year = ri.sdri_dc_acc_year
          LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = ri.sdri_item_unit_id
          LEFT JOIN inventory.item_unit_master unt ON unt.unit_id = iuc.iuc_unit_id
          LEFT JOIN inventory.godown_locations gd ON gd.gdl_id = ri.sdri_godown_id
          LEFT JOIN stock.stock_lot lot ON lot.slt_id = ri.sdri_lot_id
         WHERE ri.sdri_return_id = ${docId}::uuid
           AND ri.sdri_acc_year = ${accYear}::bpchar
           AND ri.sdri_company_id = ${companyId}::uuid
           AND ri.sdri_is_deleted = false
         ORDER BY ri.sdri_line_no`;
            const lines = dcrLineRows(raw, tamil);
            const [preparedBy, printedBy] = await Promise.all([
                this.userName(h.sdr_created_by),
                this.userName(userId),
            ]);
            return { head: dcrHeadRow(h, lines, { preparedBy, printedBy, at: new Date() }), lines };
        });
    }
};
exports.DcPrintSource = DcPrintSource;
exports.DcPrintSource = DcPrintSource = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DcPrintSource);
let DcHeaderProvider = class DcHeaderProvider {
    source;
    code = 'sales.dc.header';
    label = 'Delivery challan — company, consignee, purpose, place of supply, transport, e-way bill, totals';
    cardinality = 'one';
    constructor(source) {
        this.source = source;
    }
    async resolve(request) {
        return (await this.source.challan(request, this.code)).head;
    }
};
exports.DcHeaderProvider = DcHeaderProvider;
exports.DcHeaderProvider = DcHeaderProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [DcPrintSource])
], DcHeaderProvider);
let DcItemsProvider = class DcItemsProvider {
    source;
    code = 'sales.dc.items';
    label = 'Delivery challan — the lines (item, HSN, qty, free mark, unit, rate, taxable, GST, amount, kg)';
    cardinality = 'many';
    constructor(source) {
        this.source = source;
    }
    async resolve(request) {
        return (await this.source.challan(request, this.code)).lines.slice(0, request.rowLimit);
    }
};
exports.DcItemsProvider = DcItemsProvider;
exports.DcItemsProvider = DcItemsProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [DcPrintSource])
], DcItemsProvider);
let DcrHeaderProvider = class DcrHeaderProvider {
    source;
    code = 'sales.dcr.header';
    label = 'Challan return — company, customer, the challan it returns, reason, transport, totals';
    cardinality = 'one';
    constructor(source) {
        this.source = source;
    }
    async resolve(request) {
        return (await this.source.dcReturn(request, this.code)).head;
    }
};
exports.DcrHeaderProvider = DcrHeaderProvider;
exports.DcrHeaderProvider = DcrHeaderProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [DcPrintSource])
], DcrHeaderProvider);
let DcrItemsProvider = class DcrItemsProvider {
    source;
    code = 'sales.dcr.items';
    label = 'Challan return — the lines (item, qty, unit, condition / bucket, rate, taxable, GST, amount)';
    cardinality = 'many';
    constructor(source) {
        this.source = source;
    }
    async resolve(request) {
        return (await this.source.dcReturn(request, this.code)).lines.slice(0, request.rowLimit);
    }
};
exports.DcrItemsProvider = DcrItemsProvider;
exports.DcrItemsProvider = DcrItemsProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [DcPrintSource])
], DcrItemsProvider);
exports.DC_PRINT_PROVIDERS = [
    DcHeaderProvider,
    DcItemsProvider,
    DcrHeaderProvider,
    DcrItemsProvider,
];
//# sourceMappingURL=delivery-challan.providers.js.map