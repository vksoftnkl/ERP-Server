import { ConsoleLogger, Injectable } from '@nestjs/common';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { inspect } from 'node:util';

@Injectable()
export class FileLoggerService extends ConsoleLogger {
  private readonly logFilePath: string;
  private readonly errorLogFilePath: string;

  constructor(
    logFilePath = process.env.LOG_FILE_PATH ?? resolve(process.cwd(), 'logs/app.log'),
    errorLogFilePath = process.env.ERROR_LOG_FILE_PATH ?? resolve(process.cwd(), 'logs/error.log'),
  ) {
    super();
    this.logFilePath = resolve(logFilePath);
    this.errorLogFilePath = resolve(errorLogFilePath);
    this.ensureLogDirectory();
  }

  log(message: unknown, context?: string): void {
    super.log(message, context);
    this.writeLine('LOG', message, context);
  }

  error(message: unknown, stack?: string, context?: string): void {
    super.error(message, stack, context);
    const payload = stack ? `${this.stringify(message)}\n${stack}` : message;
    this.writeLine('ERROR', payload, context, true);
  }

  warn(message: unknown, context?: string): void {
    super.warn(message, context);
    this.writeLine('WARN', message, context);
  }

  debug(message: unknown, context?: string): void {
    super.debug(message, context);
    this.writeLine('DEBUG', message, context);
  }

  verbose(message: unknown, context?: string): void {
    super.verbose(message, context);
    this.writeLine('VERBOSE', message, context);
  }

  fatal(message: unknown, context?: string): void {
    super.fatal(message, context);
    this.writeLine('FATAL', message, context, true);
  }

  private ensureLogDirectory(): void {
    mkdirSync(dirname(this.logFilePath), { recursive: true });
    mkdirSync(dirname(this.errorLogFilePath), { recursive: true });
  }

  private writeLine(
    level: string,
    message: unknown,
    context?: string,
    writeToErrorFile = false,
  ): void {
    const timestamp = new Date().toISOString();
    const contextLabel = context ? ` [${context}]` : '';
    const line = `${timestamp} ${level}${contextLabel} ${this.stringify(message)}\n`;
    appendFileSync(this.logFilePath, line, { encoding: 'utf8' });

    if (writeToErrorFile) {
      appendFileSync(this.errorLogFilePath, line, { encoding: 'utf8' });
    }
  }

  private stringify(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }

    return inspect(message, { depth: 6, breakLength: Infinity, compact: true });
  }
}
