import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../database/prisma/prisma.service';
import { type MenuRights } from '../../../../../common/posting/rights';
import { SalesContextService } from '../../../../sales/posting/sales-context.service';
import { DeliveryPendingService } from '../../../../sales/delivery/core/delivery-pending.service';
import { DeliveryNoteReadService, type DeliveryBillView, type DeliveryLineView } from '../../../../sales/delivery/delivery-note-read.service';
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';
export interface NotePayloadNote {
    sdnId: string;
    sdnAccYear: string;
    sdnRefno: string;
    deviceCode: string | null;
    sdnDate: string | null;
    sdnDatetime: string;
    sdnStatus: string;
    sdnGodownId: string;
    godownName: string;
    sdnMode: string;
    sdnVehicleNo: string | null;
    vehicleCapacityKg: string | null;
    driverName: string | null;
    loadmanNames: string[];
    supervisorName: string | null;
    sdnCollectedBy: string | null;
    sdnCollectorPhone: string | null;
    transport: {
        transporterName: string | null;
        lrNo: string | null;
        lrDate: string | Date | null;
    };
    sdnRemarks: string | null;
    sdnPrintCount: number;
    postedOn: string | null;
    postedBy: string | null;
    cancelledOn: string | null;
    cancelledBy: string | null;
    cancelReason: string | null;
    goodsBackPkgs: string;
    qrToken: string;
}
export interface NotePayload {
    note: NotePayloadNote;
    bills: DeliveryBillView[];
    lines: DeliveryLineView[];
}
export interface OpenLine {
    billId: string;
    billRefno: string | null;
    billItemId: string;
    lineNo: number;
    itemName: string;
    unitName: string;
    godownId: string;
    godownName: string;
    lotNo: string | null;
    pendingQty: Prisma.Decimal;
}
export interface GatePassFacts {
    companyName: string | null;
    branchName: string | null;
    cameBackAt: Date | null;
    printedBy: string | null;
    at: Date;
}
export interface GatePassData {
    head: PrintRow;
    lines: PrintRow[];
    still: PrintRow[];
}
export declare function gatePassHeadRow(p: NotePayload, stillCount: number, f: GatePassFacts): PrintRow;
export declare function gatePassLineRows(p: NotePayload): PrintRow[];
export declare function stillToComeRows(p: NotePayload, open: readonly OpenLine[]): PrintRow[];
export interface SlipBill {
    sb_id: string;
    sb_acc_year: string;
    sb_bill_refno: string | null;
    sb_bill_date: Date | string | null;
    sb_bill_datetime: Date | null;
    sb_status: string;
    sb_delivery_mode: string;
    sb_delivery_status: string;
    sb_cust_name: string | null;
    sb_cust_place: string | null;
    sb_cust_phone: string | null;
    sb_remarks: string | null;
    sb_vehicle_no: string | null;
    comp_name: string | null;
    br_name: string | null;
    area_name: string | null;
    city_name: string | null;
    salesmen: string | null;
}
export interface SlipLine {
    lineNo: number;
    itemCode: string | null;
    itemName: string;
    unitName: string;
    godownId: string;
    godownName: string;
    lotNo: string | null;
    billedQty: Prisma.Decimal;
    givenQty: Prisma.Decimal;
    pendingQty: Prisma.Decimal;
    unitKg: Prisma.Decimal;
}
export declare function godownSlipHeadRow(b: SlipBill, lines: readonly SlipLine[], godownName: string | null, printedBy: string | null, at: Date): PrintRow;
export declare function godownSlipLineRows(lines: readonly SlipLine[]): PrintRow[];
export declare function billDeliveryRow(bill: {
    sb_id: string;
    sb_acc_year: string;
    sb_delivery_mode: string;
    sb_delivery_status: string;
} | null): PrintRow;
export interface PickLine {
    godownId: string;
    godownName: string;
    itemId: string;
    itemCode: string | null;
    itemName: string;
    unitId: string;
    unitName: string;
    billId: string;
    billRefno: string | null;
    billDate: string | null;
    custName: string | null;
    lineNo: number;
    lotNo: string | null;
    pendingQty: Prisma.Decimal;
    unitKg: Prisma.Decimal;
}
export declare function pickListRows(lines: readonly PickLine[]): PrintRow[];
export declare function pickListHeadRow(rows: readonly PrintRow[], asked: readonly string[], refnos: ReadonlyMap<string, string | null>, opts: {
    companyName: string | null;
    branchName: string | null;
    godownName: string | null;
    printedBy: string | null;
    at: Date;
}): PrintRow;
export interface PendingDbRow {
    row_kind: 'BILL' | 'DC';
    doc_id: string;
    doc_acc_year: string;
    doc_refno: string | null;
    doc_date: string | null;
    days_old: number | null;
    cust_name: string | null;
    area_name: string | null;
    city_name: string | null;
    salesman_names: string | null;
    delivery_mode: string | null;
    delivery_status: string | null;
    godown_names: string | null;
    open_lines: number | bigint | null;
    open_pkgs: Prisma.Decimal | string | null;
    open_kg: Prisma.Decimal | string | null;
    last_given_refno: string | null;
    last_given_at: Date | null;
    dc_note: string | null;
}
export declare function pendingRows(rows: readonly PendingDbRow[], amberDays: number, oldDays: number): PrintRow[];
export declare function pendingHeadRow(rows: readonly PrintRow[], asked: number, opts: {
    companyName: string | null;
    branchName: string | null;
    godownName: string | null;
    filterText: string | null;
    oldDays: number;
    printedBy: string | null;
    at: Date;
}): PrintRow;
interface PickData {
    head: PrintRow;
    lines: PrintRow[];
}
interface PendingData {
    head: PrintRow;
    rows: PrintRow[];
}
export declare class DeliveryPrintSource {
    private readonly prisma;
    private readonly reader;
    private readonly pending;
    private readonly salesContext;
    private readonly gate;
    private readonly slip;
    private readonly pick;
    private readonly pend;
    constructor(prisma: PrismaService, reader: DeliveryNoteReadService, pending: DeliveryPendingService, salesContext: SalesContextService);
    private get db();
    printRights(userId: string | null, menuId: number, what: string): Promise<MenuRights>;
    printedBy(userId: string | null): Promise<string | null>;
    private names;
    private godownName;
    private openLines;
    gatePass(request: ProviderRequest, code: string): Promise<GatePassData>;
    godownSlip(request: ProviderRequest, code: string): Promise<{
        head: PrintRow;
        lines: PrintRow[];
    }>;
    billDelivery(request: ProviderRequest, code: string): Promise<PrintRow>;
    pickList(request: ProviderRequest): Promise<PickData>;
    pendingList(request: ProviderRequest): Promise<PendingData>;
    private pendingDbRows;
}
export declare class GatePassHeadProvider implements PrintDataProvider {
    private readonly source;
    readonly code = "sales.delivery_note.head";
    readonly label = "Gate pass / Delivery Note \u2014 heading, crew, QR, totals, came back";
    readonly cardinality: "one";
    constructor(source: DeliveryPrintSource);
    resolve(request: ProviderRequest): Promise<PrintRow>;
}
export declare class GatePassLinesProvider implements PrintDataProvider {
    private readonly source;
    readonly code = "sales.delivery_note.lines";
    readonly label = "Gate pass / Delivery Note \u2014 the lines given (no prices)";
    readonly cardinality: "many";
    constructor(source: DeliveryPrintSource);
    resolve(request: ProviderRequest): Promise<PrintRow[]>;
}
export declare class GatePassStillProvider implements PrintDataProvider {
    private readonly source;
    readonly code = "sales.delivery_note.still_to_come";
    readonly label = "Gate pass \u2014 still to come on the same bills (every godown)";
    readonly cardinality: "many";
    constructor(source: DeliveryPrintSource);
    resolve(request: ProviderRequest): Promise<PrintRow[]>;
}
export declare class GodownSlipHeadProvider implements PrintDataProvider {
    private readonly source;
    readonly code = "sales.bill.godown_slip.head";
    readonly label = "Godown slip \u2014 the bill, customer, godown and the bill QR (no prices)";
    readonly cardinality: "one";
    constructor(source: DeliveryPrintSource);
    resolve(request: ProviderRequest): Promise<PrintRow>;
}
export declare class GodownSlipLinesProvider implements PrintDataProvider {
    private readonly source;
    readonly code = "sales.bill.godown_slip.lines";
    readonly label = "Godown slip \u2014 the bill lines still to give from the godown";
    readonly cardinality: "many";
    constructor(source: DeliveryPrintSource);
    resolve(request: ProviderRequest): Promise<PrintRow[]>;
}
export declare class BillDeliveryProvider implements PrintDataProvider {
    private readonly source;
    readonly code = "sales.bill.delivery";
    readonly label = "Sale bill \u2014 delivery mode and the \"Godown scan\" QR (Pickup / Dispatch only)";
    readonly cardinality: "one";
    constructor(source: DeliveryPrintSource);
    resolve(request: ProviderRequest): Promise<PrintRow>;
}
export declare class PickListHeadProvider implements PrintDataProvider {
    private readonly source;
    readonly code = "sales.delivery.pick_list.head";
    readonly label = "Pick list \u2014 heading and totals of the ticked bills";
    readonly cardinality: "one";
    constructor(source: DeliveryPrintSource);
    resolve(request: ProviderRequest): Promise<PrintRow>;
}
export declare class PickListLinesProvider implements PrintDataProvider {
    private readonly source;
    readonly code = "sales.delivery.pick_list.lines";
    readonly label = "Pick list \u2014 open lines by godown, then item, with sums";
    readonly cardinality: "many";
    constructor(source: DeliveryPrintSource);
    resolve(request: ProviderRequest): Promise<PrintRow[]>;
}
export declare class PendingListHeadProvider implements PrintDataProvider {
    private readonly source;
    readonly code = "sales.delivery.pending.head";
    readonly label = "Pending deliveries \u2014 heading and totals of the bills listed";
    readonly cardinality: "one";
    constructor(source: DeliveryPrintSource);
    resolve(request: ProviderRequest): Promise<PrintRow>;
}
export declare class PendingListRowsProvider implements PrintDataProvider {
    private readonly source;
    readonly code = "sales.delivery.pending.rows";
    readonly label = "Pending deliveries \u2014 one row per bill (then challan), as the screen lists them";
    readonly cardinality: "many";
    constructor(source: DeliveryPrintSource);
    resolve(request: ProviderRequest): Promise<PrintRow[]>;
}
export declare const DELIVERY_PRINT_PROVIDERS: readonly [typeof GatePassHeadProvider, typeof GatePassLinesProvider, typeof GatePassStillProvider, typeof GodownSlipHeadProvider, typeof GodownSlipLinesProvider, typeof BillDeliveryProvider, typeof PickListHeadProvider, typeof PickListLinesProvider, typeof PendingListHeadProvider, typeof PendingListRowsProvider];
export {};
