import { Prisma, type WaConnection } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { WaRelayClient, type RelayEvent } from './wa-relay.client';
import { WaSendService } from './wa-send.service';
import { WaStore } from './wa-store.service';
export declare const WA_AUDIT_SCREEN = "WhatsApp";
interface Settled {
    wmlId: string;
    accYear: string;
    result: 'SENT' | 'FAILED';
}
export interface PullResult {
    pulled: boolean;
    applied: number;
    cursor: string;
    state: string | null;
    error: string | null;
}
export declare class WaEventsService {
    private readonly store;
    private readonly relay;
    private readonly audit;
    private readonly sends;
    private readonly logger;
    readonly failures: Map<string, number>;
    private readonly lastConnectionRead;
    constructor(store: WaStore, relay: WaRelayClient, audit: AuditLogService, sends: WaSendService);
    takeLease(wacId: string): Promise<boolean>;
    releaseLease(wacId: string): Promise<void>;
    pullOnce(companyId: string, opts?: {
        force?: boolean;
    }): Promise<PullResult>;
    apply(tx: Prisma.TransactionClient, conn: WaConnection, ev: RelayEvent, settled?: Settled[]): Promise<boolean>;
    private findRow;
    private applyStatus;
    private applyTap;
    private applyStop;
    auditLedger(tx: Prisma.TransactionClient, ledId: string, name: string, before: Record<string, unknown>, after: Record<string, unknown>, notes: string, userId?: string | null): Promise<void>;
}
export {};
