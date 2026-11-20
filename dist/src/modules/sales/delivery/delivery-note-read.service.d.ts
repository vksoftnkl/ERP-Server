import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { TransportBandService } from '../posting/transport-band.service';
import type { RightsBlock } from '../posting/types/posting.types';
import { type BillKey } from './core/delivery.constants';
import { DeliveryPendingService } from './core/delivery-pending.service';
type Tx = Prisma.TransactionClient;
export interface DeliveryLineView {
    sdniId: string | null;
    lineNo: number;
    billId: string;
    billAccYear: string;
    billRefno: string | null;
    billItemId: string;
    billLineNo: number;
    itemId: string;
    itemCode: string | null;
    itemName: string;
    unitId: string;
    unitName: string;
    toBaseFactor: string;
    billGodownId: string;
    billGodownName: string;
    godownId: string;
    godownName: string;
    billLotId: string | null;
    billLotNo: string | null;
    lotId: string | null;
    lotNo: string | null;
    bucket: string;
    billedQty: string;
    givenBeforeQty: string;
    pendingQty: string;
    qty: string;
    baseQty: string;
    unitKg: string;
    weightKg: string;
    scannedQty: string;
    goodsBackQty: string;
    lotSwap: boolean;
    otherGodown: boolean;
    otherGodownOk: boolean;
    shelfQty: string;
    barcodes: string[];
    lastGiven: {
        refno: string | null;
        date: string | null;
        by: string | null;
    } | null;
    lastGoodsBack: {
        at: string;
        by: string | null;
        reason: string | null;
    } | null;
    remarks: string | null;
}
export interface DeliveryElsewhereView {
    billId: string;
    billRefno: string | null;
    billItemId: string;
    itemName: string;
    godownName: string;
    lotNo: string | null;
    unitName: string;
    unitKg: string;
    billedQty: string;
    pendingQty: string;
}
export interface DeliveryBillView {
    billId: string;
    billAccYear: string;
    billRefno: string | null;
    billDate: string | null;
    custId: string | null;
    custName: string | null;
    areaName: string | null;
    cityName: string | null;
    mode: string;
    salesmanNames: string;
    statusNow: string;
    linesHere: number;
    linesElsewhere: number;
}
interface Names {
    items: Map<string, {
        code: string | null;
        name: string;
        barcode: string | null;
    }>;
    units: Map<string, string>;
    godowns: Map<string, string>;
    lots: Map<string, string | null>;
    eans: Map<string, string[]>;
}
export declare class DeliveryNoteReadService {
    private readonly prisma;
    private readonly pending;
    private readonly transportBand;
    constructor(prisma: PrismaService, pending: DeliveryPendingService, transportBand: TransportBandService);
    private c;
    header(client: Tx | null, keys: {
        companyId: string;
        branchId?: string | null;
        sdnId: string;
        accYear?: string | null;
    }): Promise<{
        sdnId: string;
        sdnCompanyId: string;
        sdnBranchId: string;
        sdnTenantId: string | null;
        sdnAccYear: string;
        sdnDeviceId: string;
        sdnDeviceType: string | null;
        sdnSessionId: string | null;
        sdnSlno: bigint;
        sdnRefno: string;
        sdnDate: Date;
        sdnDatetime: Date;
        sdnGodownId: string;
        sdnMode: string;
        sdnVehicleId: string | null;
        sdnVehicleNo: string | null;
        sdnVehicleCapacityKg: Prisma.Decimal | null;
        sdnDriverId: string | null;
        sdnSupervisorId: string | null;
        sdnLoadmanId: string[];
        sdnCollectedBy: string | null;
        sdnCollectorPhone: string | null;
        sdnTotLines: number;
        sdnTotQty: Prisma.Decimal;
        sdnTotBags: Prisma.Decimal;
        sdnTotWeightKg: Prisma.Decimal;
        sdnBillCount: number;
        sdnStatus: string;
        sdnOverrides: string | null;
        sdnPostedOn: Date | null;
        sdnPostedBy: string | null;
        sdnCancelledOn: Date | null;
        sdnCancelledBy: string | null;
        sdnCancelReason: string | null;
        sdnPrintCount: number;
        sdnRevisionNo: number;
        sdnRemarks: string | null;
        sdnIsDeleted: boolean;
        sdnSyncDate: Date | null;
        sdnCreatedOn: Date;
        sdnCreatedBy: string;
        sdnModifiedOn: Date | null;
        sdnModifiedBy: string | null;
    } | null>;
    payload(client: Tx | null, keys: {
        companyId: string;
        branchId: string;
        accYear: string;
        sdnId: string;
    }, rights: RightsBlock): Promise<Record<string, unknown>>;
    scan(q: {
        companyId: string;
        branchId: string;
        godownId: string;
        code: string;
    }): Promise<{
        kind: "NOTE";
        bill: null;
        bills: never[];
        lines: never[];
        elsewhere: never[];
        note: {
            sdnId: string;
            sdnAccYear: string;
            sdnRefno: string;
        };
    } | {
        kind: "BILL";
        bill: {
            billId: string;
            billAccYear: string;
            billRefno: string | null;
            custName: string | null;
            mode: string;
        };
        bills: DeliveryBillView[];
        lines: DeliveryLineView[];
        elsewhere: DeliveryElsewhereView[];
        note: null;
    }>;
    openLines(client: Tx | null, companyId: string, branchId: string, godownId: string, bills: readonly BillKey[]): Promise<{
        bills: DeliveryBillView[];
        lines: DeliveryLineView[];
        elsewhere: DeliveryElsewhereView[];
    }>;
    lots(q: {
        companyId: string;
        branchId: string;
        godownId: string;
        itemId: string;
        bucket?: string;
    }): Promise<{
        lots: {
            lotId: string;
            lotNo: string | null;
            expiryDate: string | null;
            owned: string;
            notDelivered: string;
            physical: string;
        }[];
        unit: string;
    }>;
    shelvesBase(c: Tx, companyId: string, branchId: string, holdings: readonly {
        godownId: string;
        itemId: string;
        lotId: string | null;
        bucket: string;
    }[]): Promise<Map<string, Prisma.Decimal>>;
    lotsKnown(c: Tx, companyId: string, branchId: string, asks: readonly {
        godownId: string;
        itemId: string;
        lotId: string;
    }[]): Promise<Set<string>>;
    godownName(c: Tx, id: string): Promise<string>;
    names(c: Tx, q: {
        itemIds: readonly string[];
        unitIds: readonly string[];
        godownIds: readonly (string | null)[];
        lotIds: readonly (string | null)[];
    }): Promise<Names>;
    private noteEvents;
    private lastGiven;
    private elsewhere;
    private billsView;
    private people;
    private userNames;
}
export declare function holdingKey(godownId: string, itemId: string, lotId: string | null, bucket: string): string;
export declare function istClock(at: Date): string;
export {};
