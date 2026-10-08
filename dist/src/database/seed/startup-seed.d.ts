import type { LoggerService } from '@nestjs/common';
export interface StartupDatabaseTaskOptions {
    databaseUrl?: string;
    logger: LoggerService;
}
export declare const runStartupDatabaseTasks: (options: StartupDatabaseTaskOptions) => Promise<void>;
