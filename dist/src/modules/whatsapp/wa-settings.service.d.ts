import { Prisma } from '@prisma/client';
import { PrismaService } from "../../database/prisma/prisma.service";
import { AppSettingValueService } from '../settings/appSettings/app-setting-value.service';
export interface WaSettings {
    defaultLanguage: 'en' | 'ta';
    ratePerMessage: Prisma.Decimal;
    rateGstPercent: Prisma.Decimal;
    fallbackClickToChat: boolean;
    logRetentionYears: number;
}
export interface WaOnPostType {
    vchrTypeId: number;
    vchrTypeName: string;
    vchrParentId: number | null;
    kind: 'ORDER';
    templateName: string;
    on: boolean;
}
export declare const WA_SETTING_DEFAULTS: WaSettings;
export declare function parseOnPostTypes(raw: string | null | undefined): number[];
export interface WaOnPostSetting {
    ids: number[];
    defined: boolean;
}
export declare class WaSettingsService {
    private readonly prisma;
    private readonly appSettings;
    private readonly logger;
    constructor(prisma: PrismaService, appSettings: AppSettingValueService);
    read(companyId: string): Promise<WaSettings>;
    private valuesOf;
    onPostSetting(companyId: string): Promise<WaOnPostSetting>;
    private onPostOf;
    onPostTypes(companyId: string, setting?: WaOnPostSetting): Promise<WaOnPostType[]>;
    get(companyId: string): Promise<{
        onPostTypes: WaOnPostType[];
        defaultLanguage: "en" | "ta";
        ratePerMessage: string;
        rateGstPercent: string;
        fallbackClickToChat: boolean;
        logRetentionYears: number;
        companyId: string;
    }>;
    view(s: WaSettings): {
        defaultLanguage: "en" | "ta";
        ratePerMessage: string;
        rateGstPercent: string;
        fallbackClickToChat: boolean;
        logRetentionYears: number;
    };
    save(companyId: string, dto: Record<string, unknown> & {
        onPostTypes?: {
            vchrTypeId: number;
            on: boolean;
        }[];
    }): Promise<{
        onPostTypes: WaOnPostType[];
        defaultLanguage: "en" | "ta";
        ratePerMessage: string;
        rateGstPercent: string;
        fallbackClickToChat: boolean;
        logRetentionYears: number;
        companyId: string;
    }>;
}
