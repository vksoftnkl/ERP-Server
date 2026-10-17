import type { GstCompanyCredential, GstProvider, GstProviderAccount, GstProviderEndpoint, GstProviderErrorMap, GstProviderFieldMap, GstProviderService } from '@prisma/client';
import type { GstCompanyCredentialPayload, GstProviderAccountPayload, GstProviderEndpointPayload, GstProviderErrorMapPayload, GstProviderFieldMapPayload, GstProviderPayload, GstProviderServicePayload } from '../types/gst-config.types';
type GstProviderExtra = Pick<GstProviderPayload, 'services' | 'accounts' | 'endpointCount' | 'errorMapCount' | 'credentialCount'>;
export declare function toProviderPayload(row: GstProvider, extra: GstProviderExtra): GstProviderPayload;
export declare function toProviderAuditRecord(row: GstProvider): Omit<GstProviderPayload, keyof GstProviderExtra>;
export declare function toServicePayload(row: GstProviderService, endpointCount: number): GstProviderServicePayload;
export declare function toEndpointPayload(row: GstProviderEndpoint, service: Pick<GstProviderService, 'gpsGpvId' | 'gpsService' | 'gpsEnvironment'>): GstProviderEndpointPayload;
export declare function toFieldMapPayload(row: GstProviderFieldMap): GstProviderFieldMapPayload;
export declare function toErrorMapPayload(row: GstProviderErrorMap): GstProviderErrorMapPayload;
export declare function toAccountPayload(row: GstProviderAccount, gpvCode: string): GstProviderAccountPayload;
export interface GstCredentialContext {
    compName: string;
    compGstinNo: string | null;
    brName: string | null;
    brGstinNo: string | null;
    gpvCode: string;
    gpvName: string;
}
export declare function toCredentialPayload(row: GstCompanyCredential, context: GstCredentialContext, today: string): GstCompanyCredentialPayload;
export declare function istToday(now?: Date): string;
export {};
