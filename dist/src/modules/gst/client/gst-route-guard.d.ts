import type { Prisma } from '@prisma/client';
export interface GstRoute {
    provider: {
        gpvCode: string;
        gpvIsActive: boolean;
        gpvIsDeleted: boolean;
    };
    service?: {
        gpsService: string;
        gpsEnvironment: string;
        gpsIsActive: boolean;
        gpsIsDeleted: boolean;
    };
    action?: string;
    endpoint?: {
        gpeIsActive: boolean;
        gpeIsDeleted: boolean;
        gpePathTemplate: string;
        gpeQueryTemplate: string | null;
        gpeHeaders: Prisma.JsonValue | null;
    } | null;
    account?: {
        gpaIsActive: boolean;
        gpaIsDeleted: boolean;
    } | null;
    credential?: {
        gccIsActive: boolean;
        gccIsDeleted: boolean;
        gccClientIdEnc: string | null;
        gccClientSecretEnc: string | null;
    };
}
export declare function placeholdersOf(endpoint: NonNullable<GstRoute['endpoint']>): Set<string>;
export declare function gstRouteRefusal(route: GstRoute): string | null;
export declare function assertGstRouteActive(route: GstRoute, options: {
    field: string;
    title?: string;
}): void;
