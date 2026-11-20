import { OnModuleInit } from '@nestjs/common';
import { WaPostHook, type WaPostBlock, type WaPostEvent } from './hook/wa-post-hook';
import { WaSendService } from './wa-send.service';
import { WaSettingsService } from './wa-settings.service';
import { WaStore } from './wa-store.service';
export declare class WaAfterPostService implements OnModuleInit {
    private readonly hook;
    private readonly store;
    private readonly sends;
    private readonly settings;
    private readonly logger;
    constructor(hook: WaPostHook, store: WaStore, sends: WaSendService, settings: WaSettingsService);
    onModuleInit(): void;
    onPost(event: WaPostEvent): Promise<WaPostBlock | null>;
    private ticked;
}
