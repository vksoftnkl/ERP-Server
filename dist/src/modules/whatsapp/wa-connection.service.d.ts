import { WaCryptoService } from './wa-crypto.service';
import { WaEventsService } from './wa-events.service';
import { WaRelayClient } from './wa-relay.client';
import { WaSendService, type WaSendOutcome } from './wa-send.service';
import { WaSettingsService } from './wa-settings.service';
import { WaStore } from './wa-store.service';
import { type WaConnectionState } from './wa.constants';
export declare class WaConnectionService {
    private readonly store;
    private readonly relay;
    private readonly crypto;
    private readonly events;
    private readonly sends;
    private readonly settings;
    constructor(store: WaStore, relay: WaRelayClient, crypto: WaCryptoService, events: WaEventsService, sends: WaSendService, settings: WaSettingsService);
    get(companyId: string): Promise<{
        companyId: string;
        state: WaConnectionState;
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
    }>;
    private view;
    activate(dto: {
        companyId: string;
        activationCode: string;
        replace?: boolean;
    }): Promise<{
        state: string;
        shopCode: string;
        keyPrefix: string;
    }>;
    connectStart(dto: {
        companyId: string;
    }): Promise<{
        connectUrl: string;
        expiresAt: string;
    }>;
    refresh(dto: {
        companyId: string;
    }): Promise<{
        companyId: string;
        state: WaConnectionState;
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
    }>;
    disconnect(dto: {
        companyId: string;
        reason?: string | null;
    }): Promise<{
        state: "DISCONNECTED";
    }>;
    rotateKey(dto: {
        companyId: string;
    }): Promise<{
        keyPrefix: string;
        rotatedOn: string;
        oldKeyValidUntil: string;
    }>;
    test(dto: {
        companyId: string;
        phone: string;
    }): Promise<WaSendOutcome>;
    private callRelay;
    private companyInfo;
}
