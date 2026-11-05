import { Prisma } from '@prisma/client';
import { AuditLogService } from "../../modules/audit-log/audit-log.service";
import { type PartyRole } from './party-detail.map';
import type { PartyGstType } from './party-gst-type';
type PartyClient = Prisma.TransactionClient;
export interface PartySyncResult {
    otherRole: PartyRole | null;
    otherRoleUpdated: boolean;
    fields: string[];
}
export declare const NO_PARTY_SYNC: PartySyncResult;
export type PartyDetails = Record<string, unknown>;
export declare class PartySyncService {
    private readonly auditLogService;
    constructor(auditLogService: AuditLogService);
    detailsOf(role: PartyRole, dto: object, overrides?: PartyDetails): PartyDetails;
    syncOtherRole(tx: PartyClient, input: {
        role: PartyRole;
        partyId: string;
        details: PartyDetails;
        gstType: PartyGstType;
        actor: string;
        assertOtherNameFree?: (name: string, companyId: string | null) => Promise<void>;
    }): Promise<PartySyncResult>;
    private loadRole;
}
export {};
