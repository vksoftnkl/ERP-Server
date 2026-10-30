import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { WriteStream } from 'node:fs';
import { FileLoggerService } from './file-logger.service';

/** Close both streams so everything written so far is on disk. */
const flush = async (logger: FileLoggerService) => {
  const streams = logger as unknown as { logStream: WriteStream; errorStream: WriteStream };
  await Promise.all(
    [streams.logStream, streams.errorStream].map(
      (stream) => new Promise<void>((resolve) => stream.end(resolve)),
    ),
  );
};

describe('FileLoggerService', () => {
  let dir: string;
  let appLog: string;
  let errorLog: string;
  let logger: FileLoggerService;
  let stdout: jest.SpyInstance;
  let stderr: jest.SpyInstance;

  beforeEach(() => {
    // ConsoleLogger still prints; keep the jest output clean.
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    dir = mkdtempSync(join(tmpdir(), 'file-logger-'));
    // A nested folder that does not exist yet: the logger creates it.
    appLog = join(dir, 'nested', 'app.log');
    errorLog = join(dir, 'other', 'error.log');
    logger = new FileLoggerService(appLog, errorLog);
  });

  afterEach(() => {
    stdout.mockRestore();
    stderr.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes every level to the app log with a timestamp and context', async () => {
    logger.log('booted', 'Main');
    logger.warn('slow query');
    logger.debug('dbg', 'Ctx');
    logger.verbose('verbose line');
    await flush(logger);

    const lines = readFileSync(appLog, 'utf8').trimEnd().split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z LOG \[Main\] booted$/);
    expect(lines[1]).toMatch(/ WARN slow query$/);
    expect(lines[2]).toMatch(/ DEBUG \[Ctx\] dbg$/);
    expect(lines[3]).toMatch(/ VERBOSE verbose line$/);
  });

  it('copies only ERROR and FATAL into the error log', async () => {
    logger.log('fine');
    logger.error('broke', undefined, 'Svc');
    logger.fatal('dead');
    await flush(logger);

    const errors = readFileSync(errorLog, 'utf8').trimEnd().split('\n');
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/ ERROR \[Svc\] broke$/);
    expect(errors[1]).toMatch(/ FATAL dead$/);
    expect(readFileSync(appLog, 'utf8')).toContain(' LOG fine');
  });

  it('appends the stack under the message of an error', async () => {
    logger.error('broke', 'Error: broke\n    at x (y.ts:1:1)', 'Svc');
    await flush(logger);

    expect(readFileSync(errorLog, 'utf8')).toMatch(
      / ERROR \[Svc\] broke\nError: broke\n {4}at x \(y\.ts:1:1\)\n$/,
    );
  });

  it('renders a non-string message on one line', async () => {
    logger.log({ a: 1, nested: { b: [1, 2] } });
    await flush(logger);

    expect(readFileSync(appLog, 'utf8')).toMatch(/ LOG \{ a: 1, nested: \{ b: \[ 1, 2 \] \} \}\n$/);
  });

  it('appends to an existing log rather than truncating it', async () => {
    logger.log('first run');
    await flush(logger);

    const second = new FileLoggerService(appLog, errorLog);
    second.log('second run');
    await flush(second);

    const text = readFileSync(appLog, 'utf8');
    expect(text).toContain('first run');
    expect(text).toContain('second run');
  });
});
