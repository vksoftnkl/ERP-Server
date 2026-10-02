import { PrismaService } from "../../../database/prisma/prisma.service";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { GstinLookupPayload } from './types/gstin-lookup.types';
export declare class GstinLookupService {
    private readonly prisma;
    private readonly requestContextService;
    private readonly logger;
    constructor(prisma: PrismaService, requestContextService: RequestContextService);
    search(gstin: string): Promise<GstinLookupPayload>;
    private resolveConfig;
    private resolveSourceGstin;
    private buildUrl;
    private parseBody;
    private extractTaxpayer;
    private messageOf;
    private toPayload;
    private toAddress;
    private toGstRegType;
    private throwUpstream;
    private throwUnavailable;
}
