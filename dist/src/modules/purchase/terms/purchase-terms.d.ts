import { Prisma } from '@prisma/client';
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
export declare const TERMS_MENU_ID = 23;
export declare class SaveTermsDto {
    pteId?: string;
    companyId?: string | null;
    code: string;
    name: string;
    termsText: string;
    sort?: number;
    isActive?: boolean;
}
export declare class TermsRefDto {
    pteId: string;
}
export declare class TermsDeleteDto extends TermsRefDto {
}
export declare class PurchaseTermsService {
    private readonly prisma;
    private readonly ctx;
    constructor(prisma: PrismaService, ctx: RequestContextService);
    private actor;
    save(dto: SaveTermsDto): Promise<Record<string, unknown>>;
    get(pteId: string): Promise<Record<string, unknown>>;
    delete(dto: TermsDeleteDto): Promise<{
        pteId: string;
        deleted: boolean;
    }>;
}
export declare function termsOf(db: Prisma.TransactionClient | PrismaService, termsId: string, companyId: string, field?: string, opts?: {
    keep?: boolean;
}): Promise<{
    id: string;
    name: string;
    text: string;
    company: string | null;
    active: boolean;
}>;
export declare function pickableTermsId(db: Prisma.TransactionClient | PrismaService, termsId: string | null | undefined, companyId: string): Promise<string | null>;
export declare class PurchaseTermsController {
    private readonly service;
    private readonly prisma;
    private readonly ctx;
    constructor(service: PurchaseTermsService, prisma: PrismaService, ctx: RequestContextService);
    private right;
    create(dto: SaveTermsDto): Promise<{
        success: boolean;
        message: string;
        data: Record<string, unknown>;
    }>;
    get(q: TermsRefDto): Promise<{
        success: boolean;
        message: string;
        data: Record<string, unknown>;
    }>;
    delete(dto: TermsDeleteDto): Promise<{
        success: boolean;
        message: string;
        data: {
            pteId: string;
            deleted: boolean;
        };
    }>;
}
