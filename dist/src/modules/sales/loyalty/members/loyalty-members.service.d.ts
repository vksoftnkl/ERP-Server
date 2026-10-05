import { RequestContextService } from '../../../../common/request-context/request-context.service';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import { LoyaltyLedgerService } from '../../posting/loyalty-ledger.service';
import type { LoyaltyAdjustResult } from '../../posting/types/loyalty.types';
import type { LoyaltyMemberAdjustDto, LoyaltyMemberHistoryDto, LoyaltyMemberStatusDto } from './dto/loyalty-member-action.dto';
export declare const LOYALTY_STATUS_MENU_ID = 79;
export declare const LOYALTY_MEMBER_ERROR: {
    readonly NOT_FOUND: "LOYALTY_MEMBER_NOT_FOUND";
    readonly MERGED: "LOYALTY_MEMBER_MERGED";
    readonly NO_CHANGE: "LOYALTY_MEMBER_NO_CHANGE";
    readonly HAS_BALANCE: "LOYALTY_MEMBER_HAS_BALANCE";
    readonly REASON_REQUIRED: "LOYALTY_MEMBER_REASON_REQUIRED";
    readonly APPROVER_REQUIRED: "LOYALTY_MEMBER_APPROVER_REQUIRED";
    readonly YEAR_UNKNOWN: "LOYALTY_MEMBER_YEAR_UNKNOWN";
    readonly BRANCH_NOT_IN_COMPANY: "LOYALTY_MEMBER_BRANCH_NOT_IN_COMPANY";
};
export interface StatusChangeResult {
    memberId: string;
    fromStatus: string;
    toStatus: string;
    balance: number;
    drained: LoyaltyAdjustResult | null;
}
export interface HistoryStep {
    seqNo: number;
    event: string;
    fromStatus: string | null;
    toStatus: string;
    changedOn: Date;
    changedBy: string;
    changedByName: string | null;
    remarks: string | null;
}
export declare class LoyaltyMembersService {
    private readonly prisma;
    private readonly requestContext;
    private readonly ledger;
    constructor(prisma: PrismaService, requestContext: RequestContextService, ledger: LoyaltyLedgerService);
    setStatus(dto: LoyaltyMemberStatusDto): Promise<StatusChangeResult>;
    adjust(dto: LoyaltyMemberAdjustDto): Promise<LoyaltyAdjustResult>;
    history(q: LoyaltyMemberHistoryDto): Promise<{
        memberId: string;
        steps: HistoryStep[];
    }>;
    private assertRight;
    private lockMember;
    private assertBranch;
    private fallbackBranch;
    private today;
    private yearOf;
    private actorName;
}
