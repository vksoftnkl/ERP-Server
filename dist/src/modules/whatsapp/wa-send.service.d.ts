import { Prisma } from '@prisma/client';
import { PrintRenderService } from '../settings/print-render/print-render.service';
import { AppSettingValueService } from '../settings/appSettings/app-setting-value.service';
import { type DocFacts } from './wa-doc-facts';
import { WaRelayClient } from './wa-relay.client';
import { WaSettingsService } from './wa-settings.service';
import { WaStore, type WaActor } from './wa-store.service';
import { type WaDocType, type WaKind, type WaPhoneSource, type WaStatus, type WaTrigger } from './wa.constants';
export interface WaSendOutcome {
    wmlId: string;
    accYear: string;
    status: WaStatus;
    phone: string | null;
    phoneSource: WaPhoneSource | null;
    templateName: string | null;
    lang: string | null;
    langNote: string | null;
    errorCode: string | null;
    errorText: string | null;
}
export interface PreparedSend {
    wmlId: string;
    accYear: string;
    companyId: string;
    branchId: string | null;
    kind: WaKind;
    trigger: WaTrigger;
    status: WaStatus;
    phone: string | null;
    phoneSource: WaPhoneSource | null;
    templateName: string;
    lang: string | null;
    langNote: string | null;
    errorCode: string | null;
    errorText: string | null;
    params: Record<string, string>;
    pdf: {
        purposeCode: string;
        docId: string | null;
        docAccYear: string | null;
        params: Record<string, unknown>;
        filename: string;
    } | null;
    doc: DocFacts | null;
    actor: WaActor;
    pendingStep?: boolean;
}
export declare class WaSendService {
    private readonly store;
    private readonly settings;
    private readonly relay;
    private readonly print;
    private readonly appSettings;
    private readonly logger;
    readonly inFlight: Set<string>;
    constructor(store: WaStore, settings: WaSettingsService, relay: WaRelayClient, print: PrintRenderService, appSettings: AppSettingValueService);
    prepareDocument(p: {
        companyId: string;
        docType: WaDocType;
        docId: string;
        docAccYear: string;
        trigger: WaTrigger;
        bodyPhone?: string | null;
        lang?: string | null;
        tryNo?: number;
        retryOf?: string | null;
        actor: WaActor;
    }, tx?: Prisma.TransactionClient): Promise<PreparedSend | {
        notConnected: true;
        fallbackClickToChat: boolean;
    }>;
    prepareTest(p: {
        companyId: string;
        phone: string;
        tryNo?: number;
        retryOf?: string | null;
        actor: WaActor;
    }, tx?: Prisma.TransactionClient): Promise<PreparedSend>;
    private refuseNotConnected;
    private isWalkIn;
    private docParams;
    private writeSkipOrFail;
    private writeRow;
    deliver(p: PreparedSend): Promise<WaSendOutcome>;
    deliverForAnswer(p: PreparedSend, ms?: number): Promise<WaSendOutcome>;
    fail(p: PreparedSend, code: string, text: string, metaCode?: number | null): Promise<WaSendOutcome>;
    outcome(p: PreparedSend): WaSendOutcome;
    private statusStep;
    statusStepForRow(wmlId: string, accYear: string, result: 'SENT' | 'FAILED'): Promise<void>;
}
