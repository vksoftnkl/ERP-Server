import { RequestContextService } from "../../../common/request-context/request-context.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
export declare const ATT: {
    readonly TOO_BIG: "ATTACHMENT_TOO_BIG";
    readonly BAD_FILE: "ATTACHMENT_INVALID";
};
export declare class AttachmentListQueryDto {
    docType: string;
    docId: string;
}
export declare class AttachmentRefDto {
    tatId: string;
    accYear: string;
}
export declare class UploadAttachmentDto {
    companyId: string;
    branchId: string;
    accYear: string;
    docType: string;
    docId: string;
    fileName: string;
    mime: string;
    caption?: string;
    contentBase64: string;
}
export declare class PurchaseAttachmentService {
    private readonly prisma;
    private readonly ctx;
    constructor(prisma: PrismaService, ctx: RequestContextService);
    private get db();
    list(q: AttachmentListQueryDto): Promise<Record<string, unknown>[]>;
    upload(dto: UploadAttachmentDto): Promise<{
        tatId: string;
        accYear: string;
        pageNo: number;
        size: number;
    }>;
    file(q: AttachmentRefDto): Promise<{
        tatId: string;
        fileName: string;
        mime: string;
        contentBase64: string;
    }>;
    remove(dto: AttachmentRefDto): Promise<{
        tatId: string;
        deleted: boolean;
    }>;
}
export declare class PurchaseAttachmentController {
    private readonly service;
    constructor(service: PurchaseAttachmentService);
    list(q: AttachmentListQueryDto): Promise<{
        success: boolean;
        message: string;
        data: Record<string, unknown>[];
    }>;
    file(q: AttachmentRefDto): Promise<{
        success: boolean;
        message: string;
        data: {
            tatId: string;
            fileName: string;
            mime: string;
            contentBase64: string;
        };
    }>;
    upload(dto: UploadAttachmentDto): Promise<{
        success: boolean;
        message: string;
        data: {
            tatId: string;
            accYear: string;
            pageNo: number;
            size: number;
        };
    }>;
    remove(dto: AttachmentRefDto): Promise<{
        success: boolean;
        message: string;
        data: {
            tatId: string;
            deleted: boolean;
        };
    }>;
}
