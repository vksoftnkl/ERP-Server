import { WaActivateDto, WaCompanyDto, WaDisconnectDto, WaSettingsSaveDto, WaTestDto } from '../dto/wa.dto';
import { WaConnectionService } from '../wa-connection.service';
import { WaSettingsService } from '../wa-settings.service';
import { WaStore } from '../wa-store.service';
export declare class WaConnectionController {
    private readonly connection;
    private readonly settings;
    private readonly store;
    constructor(connection: WaConnectionService, settings: WaSettingsService, store: WaStore);
    get(q: WaCompanyDto): Promise<{
        success: true;
        message: string;
        data: {
            companyId: string;
            state: import("../wa.constants").WaConnectionState;
            shopCode: string | null;
            keyPrefix: string | null;
            displayName: string | null;
            displayPhone: string | null;
            wabaId: string | null;
            phoneNumberId: string | null;
            qualityRating: string | null;
            messagingLimit: number | null;
            usedToday: number;
            connectedOn: string | null;
            lastPollOn: string | null;
            lastPollError: string | null;
            relayReachable: boolean;
            fallbackClickToChat: boolean;
            templates: {
                name: string;
                lang: string;
                purpose: string;
                category: string | null;
                status: string;
                reason: string | null;
                body: string | null;
                params: import("@prisma/client/runtime/library").JsonValue;
                headerKind: string;
                buttons: import("@prisma/client/runtime/library").JsonValue;
                statusOn: string | null;
            }[];
        };
    }>;
    activate(dto: WaActivateDto): Promise<{
        success: true;
        message: string;
        data: {
            state: string;
            shopCode: string;
            keyPrefix: string;
        };
    }>;
    connectStart(dto: WaCompanyDto): Promise<{
        success: true;
        message: string;
        data: {
            connectUrl: string;
            expiresAt: string;
        };
    }>;
    refresh(dto: WaCompanyDto): Promise<{
        success: true;
        message: string;
        data: {
            companyId: string;
            state: import("../wa.constants").WaConnectionState;
            shopCode: string | null;
            keyPrefix: string | null;
            displayName: string | null;
            displayPhone: string | null;
            wabaId: string | null;
            phoneNumberId: string | null;
            qualityRating: string | null;
            messagingLimit: number | null;
            usedToday: number;
            connectedOn: string | null;
            lastPollOn: string | null;
            lastPollError: string | null;
            relayReachable: boolean;
            fallbackClickToChat: boolean;
            templates: {
                name: string;
                lang: string;
                purpose: string;
                category: string | null;
                status: string;
                reason: string | null;
                body: string | null;
                params: import("@prisma/client/runtime/library").JsonValue;
                headerKind: string;
                buttons: import("@prisma/client/runtime/library").JsonValue;
                statusOn: string | null;
            }[];
        };
    }>;
    disconnect(dto: WaDisconnectDto): Promise<{
        success: true;
        message: string;
        data: {
            state: "DISCONNECTED";
        };
    }>;
    rotateKey(dto: WaCompanyDto): Promise<{
        success: true;
        message: string;
        data: {
            keyPrefix: string;
            rotatedOn: string;
            oldKeyValidUntil: string;
        };
    }>;
    test(dto: WaTestDto): Promise<{
        success: true;
        message: string;
        data: import("../wa-send.service").WaSendOutcome;
    }>;
    settingsGet(q: WaCompanyDto): Promise<{
        success: true;
        message: string;
        data: {
            onPostTypes: import("../wa-settings.service").WaOnPostType[];
            defaultLanguage: "en" | "ta";
            ratePerMessage: string;
            rateGstPercent: string;
            fallbackClickToChat: boolean;
            logRetentionYears: number;
            companyId: string;
        };
    }>;
    settingsSave(dto: WaSettingsSaveDto): Promise<{
        success: true;
        message: string;
        data: {
            onPostTypes: import("../wa-settings.service").WaOnPostType[];
            defaultLanguage: "en" | "ta";
            ratePerMessage: string;
            rateGstPercent: string;
            fallbackClickToChat: boolean;
            logRetentionYears: number;
            companyId: string;
        };
    }>;
}
