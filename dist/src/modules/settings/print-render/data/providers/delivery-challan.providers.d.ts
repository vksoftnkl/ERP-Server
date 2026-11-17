import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../database/prisma/prisma.service';
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';
type Num = Prisma.Decimal | string | number | null | undefined;
export declare function dashDate(value: Date | string | null | undefined): string;
export declare function dashInstant(at: Date | string | null | undefined): string;
export declare function purposeText(purpose: string | null | undefined): string;
export interface CompanyCols {
    comp_name: string | null;
    comp_legal_name: string | null;
    comp_addr1: string | null;
    comp_addr2: string | null;
    comp_addr3: string | null;
    comp_city: string | null;
    comp_state: string | null;
    comp_state_code: string | null;
    comp_pin: string | null;
    comp_gstin_no: string | null;
    comp_phone: string | null;
    comp_mail: string | null;
    comp_state_by_code: string | null;
    br_name: string | null;
    br_gstin_no: string | null;
}
export interface MoveCols {
    vehicle_no: string | null;
    driver_name: string | null;
    supervisor_name: string | null;
    loadman_names: string | null;
    salesman_names: string | null;
    ttd_transport_mode: string | null;
    ttd_transporter_name: string | null;
    ttd_transporter_gstin: string | null;
    ttd_lr_no: string | null;
    ttd_lr_date: Date | string | null;
    ttd_distance_km: number | null;
    gdw_no: string | null;
    gdw_status: string | null;
    gdw_generated_on: Date | null;
    gdw_valid_upto: Date | null;
}
export interface PrintFacts {
    preparedBy: string | null;
    printedBy: string | null;
    at: Date;
}
export interface DcHeadDb extends CompanyCols, MoveCols {
    sdc_id: string;
    sdc_acc_year: string;
    sdc_branch_id: string;
    sdc_dc_refno: string | null;
    sdc_dc_date: Date | string | null;
    sdc_purpose: string | null;
    sdc_status: string;
    sdc_print_count: number | null;
    sdc_src_doc_type: string | null;
    sdc_src_doc_refno: string | null;
    sdc_src_doc_date: Date | string | null;
    sdc_usr_refno: string | null;
    sdc_usr_refdate: Date | string | null;
    sdc_cust_name: string | null;
    sdc_cust_addr: string | null;
    sdc_cust_place: string | null;
    sdc_cust_pin: string | null;
    sdc_cust_phone: string | null;
    sdc_cust_gstin: string | null;
    sdc_cust_gst_type: string | null;
    sdc_cust_stcd: string | null;
    sdc_pos_stcd: string | null;
    sdc_state_name: string | null;
    cust_state_by_code: string | null;
    pos_state_name: string | null;
    sdc_gross_amt: Num;
    sdc_disc_amt: Num;
    sdc_taxable_amt: Num;
    sdc_cgst_amt: Num;
    sdc_sgst_amt: Num;
    sdc_igst_amt: Num;
    sdc_cess_amt: Num;
    sdc_tax_amt: Num;
    sdc_round_off: Num;
    sdc_dc_amt: Num;
    sdc_remarks: string | null;
    sdc_created_by: string | null;
    ttd_to_name: string | null;
    ttd_to_addr: string | null;
    ttd_to_place: string | null;
    ttd_to_pin: string | null;
    ttd_to_godown_name: string | null;
}
export interface DcLineDb {
    sdi_line_no: number;
    sdi_split_no: number | null;
    sdi_item_id: string;
    item_code: string | null;
    item_name_en: string | null;
    item_name_ta: string | null;
    hsn_code: string | null;
    sdi_batch_no: string | null;
    lot_no: string | null;
    godown_name: string | null;
    unit_name: string | null;
    unit_code: string | null;
    unit_kg: Num;
    sdi_dc_qty: Num;
    sdi_free_qty: Num;
    sdi_weight_qty: Num;
    sdi_is_free: boolean | null;
    sdi_free_type: string | null;
    sdi_src_doc_type: string | null;
    sdi_src_doc_refno: string | null;
    sdi_rate: Num;
    sdi_rate_pre_tax: Num;
    sdi_disc_amt: Num;
    sdi_gross_amt: Num;
    sdi_taxable_amt: Num;
    sdi_tax_perc: Num;
    sdi_cgst_perc: Num;
    sdi_cgst_amt: Num;
    sdi_sgst_perc: Num;
    sdi_sgst_amt: Num;
    sdi_igst_perc: Num;
    sdi_igst_amt: Num;
    sdi_cess_perc: Num;
    sdi_cess_amt: Num;
    sdi_tax_amt: Num;
    sdi_net_amt: Num;
    sdi_remarks: string | null;
}
export declare function dcLineRows(lines: readonly DcLineDb[], tamil?: boolean): PrintRow[];
export declare function dcHeadRow(h: DcHeadDb, lines: readonly PrintRow[], f: PrintFacts): PrintRow;
export interface DcrHeadDb extends CompanyCols, MoveCols {
    sdr_id: string;
    sdr_acc_year: string;
    sdr_branch_id: string;
    sdr_return_refno: string | null;
    sdr_return_date: Date | string | null;
    sdr_status: string;
    sdr_print_count: number | null;
    sdr_dc_refno: string | null;
    sdr_dc_date: Date | string | null;
    sdr_return_reason: string | null;
    sdr_usr_refno: string | null;
    sdr_usr_refdate: Date | string | null;
    sdr_cust_name: string | null;
    sdr_cust_gstin: string | null;
    sdr_cust_stcd: string | null;
    sdr_pos_stcd: string | null;
    sdc_cust_addr: string | null;
    sdc_cust_place: string | null;
    sdc_cust_pin: string | null;
    sdc_cust_phone: string | null;
    sdc_cust_gst_type: string | null;
    sdc_state_name: string | null;
    sdc_purpose: string | null;
    reason_code: string | null;
    reason_name: string | null;
    cust_state_by_code: string | null;
    pos_state_name: string | null;
    sdr_taxable_amt: Num;
    sdr_tax_amt: Num;
    sdr_return_amt: Num;
    sdr_remarks: string | null;
    sdr_created_by: string | null;
}
export interface DcrLineDb {
    sdri_line_no: number;
    sdri_dc_line_no: number | null;
    sdri_item_id: string;
    item_code: string | null;
    item_name_en: string | null;
    item_name_ta: string | null;
    hsn_code: string | null;
    sdri_batch_no: string | null;
    lot_no: string | null;
    godown_name: string | null;
    unit_name: string | null;
    unit_code: string | null;
    unit_kg: Num;
    sdri_return_qty: Num;
    sdri_free_qty: Num;
    sdri_weight_qty: Num;
    sdri_condition: string | null;
    sdri_bucket: string | null;
    is_free: boolean | null;
    free_type: string | null;
    sdri_rate: Num;
    sdri_rate_pre_tax: Num;
    sdri_gross_amt: Num;
    sdri_taxable_amt: Num;
    sdri_tax_perc: Num;
    sdri_cgst_perc: Num;
    sdri_cgst_amt: Num;
    sdri_sgst_perc: Num;
    sdri_sgst_amt: Num;
    sdri_igst_perc: Num;
    sdri_igst_amt: Num;
    sdri_cess_perc: Num;
    sdri_cess_amt: Num;
    sdri_tax_amt: Num;
    sdri_net_amt: Num;
    sdri_remarks: string | null;
}
export declare function dcrLineRows(lines: readonly DcrLineDb[], tamil?: boolean): PrintRow[];
export declare function dcrHeadRow(h: DcrHeadDb, lines: readonly PrintRow[], f: PrintFacts): PrintRow;
export interface DcPrintData {
    head: PrintRow;
    lines: PrintRow[];
}
export declare class DcPrintSource {
    private readonly prisma;
    private readonly dc;
    private readonly dcr;
    constructor(prisma: PrismaService);
    private get db();
    printRights(userId: string | null, menuId: number, what: string): Promise<void>;
    userName(idOrText: string | null | undefined): Promise<string | null>;
    challan(request: ProviderRequest, code: string): Promise<DcPrintData>;
    dcReturn(request: ProviderRequest, code: string): Promise<DcPrintData>;
}
export declare class DcHeaderProvider implements PrintDataProvider {
    private readonly source;
    readonly code = "sales.dc.header";
    readonly label = "Delivery challan \u2014 company, consignee, purpose, place of supply, transport, e-way bill, totals";
    readonly cardinality: "one";
    constructor(source: DcPrintSource);
    resolve(request: ProviderRequest): Promise<PrintRow>;
}
export declare class DcItemsProvider implements PrintDataProvider {
    private readonly source;
    readonly code = "sales.dc.items";
    readonly label = "Delivery challan \u2014 the lines (item, HSN, qty, free mark, unit, rate, taxable, GST, amount, kg)";
    readonly cardinality: "many";
    constructor(source: DcPrintSource);
    resolve(request: ProviderRequest): Promise<PrintRow[]>;
}
export declare class DcrHeaderProvider implements PrintDataProvider {
    private readonly source;
    readonly code = "sales.dcr.header";
    readonly label = "Challan return \u2014 company, customer, the challan it returns, reason, transport, totals";
    readonly cardinality: "one";
    constructor(source: DcPrintSource);
    resolve(request: ProviderRequest): Promise<PrintRow>;
}
export declare class DcrItemsProvider implements PrintDataProvider {
    private readonly source;
    readonly code = "sales.dcr.items";
    readonly label = "Challan return \u2014 the lines (item, qty, unit, condition / bucket, rate, taxable, GST, amount)";
    readonly cardinality: "many";
    constructor(source: DcPrintSource);
    resolve(request: ProviderRequest): Promise<PrintRow[]>;
}
export declare const DC_PRINT_PROVIDERS: readonly [typeof DcHeaderProvider, typeof DcItemsProvider, typeof DcrHeaderProvider, typeof DcrItemsProvider];
export {};
