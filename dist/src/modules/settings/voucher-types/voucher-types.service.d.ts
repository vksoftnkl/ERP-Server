import { ConfigService } from '@nestjs/config';
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { AuditLogService } from '../../audit-log/audit-log.service';
import type { PrintDesignCloneDto } from './dto/voucher-type-query.dto';
import type { SaveVoucherTypeDto } from './dto/save-voucher-type.dto';
import type { VoucherTypeNode, VoucherTypePayload, VoucherTypePrintDesign, VoucherTypeValidation } from './types/voucher-types-api.types';
import { type VtIssue } from './voucher-types.rules';
export declare const OFFER_BASE_SETTING_KEY = "sales.offer_base_bill_type";
export declare class VoucherTypesService {
    private readonly prisma;
    private readonly ctx;
    private readonly auditLogService;
    private readonly config;
    constructor(prisma: PrismaService, ctx: RequestContextService, auditLogService: AuditLogService, config: ConfigService);
    private actor;
    private assertRight;
    private assertOnline;
    private resolveCompany;
    private companyMismatch;
    private notFound;
    private loadForCompany;
    tree(companyId: string, includeInactive?: boolean): Promise<{
        nodes: VoucherTypeNode[];
    }>;
    get(q: {
        companyId: string;
        branchId: string;
        accYear: string;
        vchrTypeId: number;
    }): Promise<VoucherTypePayload>;
    private payload;
    private inheritedOf;
    validate(dto: SaveVoucherTypeDto): Promise<VoucherTypeValidation>;
    save(dto: SaveVoucherTypeDto): Promise<VoucherTypePayload & {
        warnings: VtIssue[];
    }>;
    private judge;
    private write;
    inactivate(dto: {
        companyId: string;
        vchrTypeId: number;
    }): Promise<{
        vchrTypeId: number;
        vchrIsActive: false;
        name: string;
    }>;
    remove(dto: {
        companyId: string;
        vchrTypeId: number;
    }): Promise<{
        vchrTypeId: number;
        deleted: true;
        name: string;
    }>;
    clonePrintDesign(dto: PrintDesignCloneDto): Promise<VoucherTypePrintDesign>;
    private previewBranch;
    private branchRows;
    private numberingFacts;
    private namedRows;
    private billCount;
    private inUse;
    private hasCounterThisYear;
    private counters;
    private voucherFacts;
    private branchStates;
    private printDocType;
    private printDesigns;
    private purposeAllowed;
    private readOfferBase;
    private writeOfferBase;
}
export declare function uniqueRaceIssue(hit: string | null): VtIssue;
