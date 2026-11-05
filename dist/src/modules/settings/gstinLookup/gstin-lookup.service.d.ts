import { PrismaService } from "../../../database/prisma/prisma.service";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { GstHttpClient } from '../../gst/client/gst-http.client';
import { GstCryptoService } from '../../gst/config/gst-crypto.service';
import { GstinLookupPayload } from './types/gstin-lookup.types';
export declare class GstinLookupService {
    private readonly prisma;
    private readonly requestContextService;
    private readonly crypto;
    private readonly http;
    private readonly logger;
    constructor(prisma: PrismaService, requestContextService: RequestContextService, crypto: GstCryptoService, http: GstHttpClient);
    search(gstin: string): Promise<GstinLookupPayload>;
    private resolveRoute;
    private resolveSource;
    private buildRequest;
    private parseBody;
    private extractTaxpayer;
    private providerErrorOf;
    private messageOf;
    private at;
    private toPayload;
    private toAddress;
    private toGstRegType;
    private log;
    private throwUpstream;
    private throwUnavailable;
}
