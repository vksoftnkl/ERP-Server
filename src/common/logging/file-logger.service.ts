import { ConsoleLogger, Injectable } from '@nestjs/common';
import { createWriteStream, mkdirSync, WriteStream } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { inspect } from 'node:util';
@Injectable()
export class FileLoggerService extends ConsoleLogger {
  private readonly logStream: WriteStream;
  private readonly errorStream: WriteStream;
  constructor(
    logFilePath = process.env.LOG_FILE_PATH ?? resolve(process.cwd(), 'logs/app.log'),
    errorLogFilePath = process.env.ERROR_LOG_FILE_PATH ?? resolve(process.cwd(), 'logs/error.log'),
  ) {
    super();
    const resolvedLogPath = resolve(logFilePath);
    const resolvedErrorPath = resolve(errorLogFilePath);
    mkdirSync(dirname(resolvedLogPath), { recursive: true });
    mkdirSync(dirname(resolvedErrorPath), { recursive: true });
    this.logStream = createWriteStream(resolvedLogPath, { flags: 'a', encoding: 'utf8' });
    this.errorStream = createWriteStream(resolvedErrorPath, { flags: 'a', encoding: 'utf8' });
    this.logStream.on('error', (err) => process.stderr.write(`Log stream error: ${err.message}\n`));
    this.errorStream.on('error', (err) =>
      process.stderr.write(`Error log stream error: ${err.message}\n`),
    );
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
  private writeLine(
    level: string,
    message: unknown,
    context?: string,
    writeToErrorFile = false,
  ): void {
    const timestamp = new Date().toISOString();
    const contextLabel = context ? ` [${context}]` : '';
    const line = `${timestamp} ${level}${contextLabel} ${this.stringify(message)}\n`;
    this.logStream.write(line);
    if (writeToErrorFile) {
      this.errorStream.write(line);
    }
  }
  private stringify(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }
    return inspect(message, { depth: 6, breakLength: Infinity, compact: true });
  }
}