import { ConsoleLogger } from '@nestjs/common';
export declare class FileLoggerService extends ConsoleLogger {
    private readonly logFilePath;
    private readonly errorLogFilePath;
    constructor(logFilePath?: string, errorLogFilePath?: string);
    log(message: unknown, context?: string): void;
    error(message: unknown, stack?: string, context?: string): void;
    warn(message: unknown, context?: string): void;
    debug(message: unknown, context?: string): void;
    verbose(message: unknown, context?: string): void;
    fatal(message: unknown, context?: string): void;
    private ensureLogDirectory;
    private writeLine;
    private stringify;
}
