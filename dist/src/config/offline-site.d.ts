import type { ConfigService } from '@nestjs/config';
export declare const OFFLINE_SITE_CONFIG_KEY = "cloudSync.enabled";
export declare function isOfflineSite(config: Pick<ConfigService, 'get'> | null | undefined): boolean;
