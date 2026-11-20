import { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { WaCryptoService } from './wa-crypto.service';
import { WaEventsService } from './wa-events.service';
import { WaSendService } from './wa-send.service';
import { WaSettingsService } from './wa-settings.service';
import { WaStore } from './wa-store.service';
interface DueRow {
    wac_company_id: string;
    wac_state: string;
    wac_last_poll_on: Date | null;
    wac_fast_poll_until: Date | null;
}
export declare function pollDue(row: DueRow, failures: number, now: number): boolean;
export declare class WaPollerService implements OnApplicationBootstrap, OnModuleDestroy {
    private readonly store;
    private readonly events;
    private readonly sends;
    private readonly settings;
    private readonly crypto;
    private readonly logger;
    private timer;
    private running;
    private lastSweep;
    private lastRetention;
    constructor(store: WaStore, events: WaEventsService, sends: WaSendService, settings: WaSettingsService, crypto: WaCryptoService);
    onApplicationBootstrap(): void;
    onModuleDestroy(): void;
    tick(now?: number): Promise<void>;
    sweepSending(): Promise<number>;
    purge(): Promise<number>;
}
export {};
