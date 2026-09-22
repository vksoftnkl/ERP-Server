import { Prisma } from '@prisma/client';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { TxnStatusDocType, TxnStatusEvent } from "../../../common/txn-status-log/txn-status-log.helper";
import { ChargeDetailService } from '../../master/charge-detail/charge-detail.service';
import type { ChargeDocType } from '../../master/charge-master/types/charge-enum';
import { TenderDetailService } from '../../accountsModule/tenderDetail/tender-detail.service';
import { TenderDrCr, TenderSrcDocType } from '../../accountsModule/tenderDetail/types/tender-detail-api.types';
import { TransportBandService, type TransportDocType } from './transport-band.service';
export type DocRow = Record<string, unknown> & {
    [k: string]: unknown;
};
export interface DocSpec {
    kind: 'DELIVERY_CHALLAN' | 'DC_RETURN' | 'SALE_RETURN';
    headerDelegate: string;
    itemDelegate: string;
    p: string;
    ip: string;
    itemFk: string;
    refnoField: string;
    slnoField: string;
    dateField: string;
    datetimeField: string;
    custField: string;
    custNameField: string | null;
    revisionField: string | null;
    voucherTypeId: number;
    menuId: number;
    statusDocType: TxnStatusDocType;
    chargeDocType: ChargeDocType | null;
    tenderDocType: TenderSrcDocType | null;
    tenderDrCr: TenderDrCr;
    transportDocType: TransportDocType;
    transportDirection: 'OUTWARD' | 'INWARD';
    tableName: string;
    itemTableName: string;
    screenName: string;
    optionalFields: readonly string[];
    dateFields: readonly string[];
    serverOwned: readonly string[];
    itemOptionalFields: readonly string[];
    itemDateFields: readonly string[];
    itemRequired: readonly string[];
    headerRequired: readonly string[];
    itemDefaults?: (header: DocRow) => DocRow;
    headerWhereUnique: string;
    itemWhereUnique: string;
}
export interface DocKeys {
    id: string;
    companyId: string;
    branchId: string;
    accYear: string;
}
export declare class SalesDocStore {
    readonly spec: DocSpec;
    private readonly audit;
    private readonly charges;
    private readonly tenders;
    private readonly transportBand;
    constructor(spec: DocSpec, audit: AuditLogService, charges: ChargeDetailService, tenders: TenderDetailService, transportBand: TransportBandService);
    f(name: string): string;
    fi(name: string): string;
    private header;
    private items;
    private whereHeader;
    private whereItem;
    keysOf(row: DocRow): DocKeys;
    status(row: DocRow): string;
    refno(row: DocRow): string | null;
    find(c: Prisma.TransactionClient, keys: DocKeys): Promise<DocRow | null>;
    findOrThrow(c: Prisma.TransactionClient, keys: DocKeys): Promise<DocRow>;
    lock(tx: Prisma.TransactionClient, keys: DocKeys): Promise<DocRow>;
    loadItems(c: Prisma.TransactionClient, row: DocRow): Promise<DocRow[]>;
    loadCharges(row: DocRow): Promise<import("../../master/charge-detail/types/charge-detail-api.types").ChargeDetailPayload[]>;
    loadTenders(row: DocRow): Promise<import("../../accountsModule/tenderDetail/types/tender-detail-api.types").TenderDetailPayload[]>;
    loadTransport(c: Prisma.TransactionClient, row: DocRow): Promise<import("./transport-band.service").TransportBandRow | null>;
    saveDraft(tx: Prisma.TransactionClient, dto: DocRow, actor: string, now: Date, hooks?: {
        beforeWrite?: (data: DocRow, existing: DocRow | null) => Promise<void> | void;
        afterWrite?: (row: DocRow, items: DocRow[]) => Promise<void> | void;
    }): Promise<DocRow>;
    private syncItems;
    deleteDraft(tx: Prisma.TransactionClient, keys: DocKeys, actor: string, now: Date): Promise<DocRow>;
    setStatus(tx: Prisma.TransactionClient, row: DocRow, status: string, extra: DocRow, actor: string, now: Date): Promise<DocRow>;
    updateItem(tx: Prisma.TransactionClient, item: DocRow, data: DocRow): Promise<DocRow>;
    trail(tx: Prisma.TransactionClient, row: DocRow, event: TxnStatusEvent | string, from: string | null, to: string, actor: string, now: Date, remarks: string | null, write?: boolean): Promise<void>;
    auditChange(tx: Prisma.TransactionClient, row: DocRow, action: 'update' | 'cancel' | 'approve', before: unknown, after: unknown, actor: string, notes: string): Promise<void>;
    plain(row: DocRow): Record<string, unknown>;
    private dateTransforms;
}
