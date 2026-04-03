import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Socket, createConnection } from 'node:net';
import { TLSSocket, connect as createTlsConnection } from 'node:tls';
type RedisReply = string | number | null | RedisReply[];
type PendingResponse = {
  resolve: (value: RedisReply) => void;
  reject: (reason?: unknown) => void;
};
type ParsedRedisReply = {
  value: RedisReply;
  isError: boolean;
  nextOffset: number;
};
@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly enabled: boolean;
  private readonly host: string;
  private readonly port: number;
  private readonly username: string;
  private readonly password: string;
  private readonly database: number;
  private readonly tlsEnabled: boolean;
  private readonly connectTimeoutMs: number;
  private socket: Socket | TLSSocket | null = null;
  private connectPromise: Promise<void> | null = null;
  private readBuffer = Buffer.alloc(0);
  private pendingResponses: PendingResponse[] = [];
  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<boolean>('redis.enabled', false);
    this.host = this.configService.get<string>('redis.host', '127.0.0.1');
    this.port = this.configService.get<number>('redis.port', 6379);
    this.username = this.configService.get<string>('redis.username', '');
    this.password = this.configService.get<string>('redis.password', '');
    this.database = this.configService.get<number>('redis.db', 0);
    this.tlsEnabled = this.configService.get<boolean>('redis.tls', false);
    this.connectTimeoutMs = this.configService.get<number>('redis.connectTimeoutMs', 5000);
  }
  isEnabled(): boolean {
    return this.enabled;
  }
  async ping(): Promise<'PONG' | 'DISABLED'> {
    if (!this.enabled) {
      return 'DISABLED';
    }
    const response = await this.runCommand(['PING']);
    if (response !== 'PONG') {
      throw new ServiceUnavailableException('Redis cache returned an invalid health response');
    }
    return 'PONG';
  }
  async get(key: string): Promise<string | null> {
    if (!this.enabled) {
      return null;
    }
    const response = await this.runCommand(['GET', key]);
    if (response === null) {
      return null;
    }
    if (typeof response !== 'string') {
      throw new ServiceUnavailableException('Redis cache returned an invalid string response');
    }
    return response;
  }
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (!this.enabled) {
      return;
    }
    const normalizedTtl = Math.max(1, Math.floor(ttlSeconds));
    const response = await this.runCommand(['SET', key, value, 'EX', normalizedTtl.toString()]);
    if (response !== 'OK') {
      throw new ServiceUnavailableException('Redis cache failed to persist the value');
    }
  }
  async del(key: string): Promise<number> {
    if (!this.enabled) {
      return 0;
    }
    const response = await this.runCommand(['DEL', key]);
    if (typeof response !== 'number') {
      throw new ServiceUnavailableException('Redis cache returned an invalid delete response');
    }
    return response;
  }
  async delMany(keys: string[]): Promise<number> {
    if (!this.enabled || keys.length === 0) {
      return 0;
    }
    const response = await this.runCommand(['DEL', ...keys]);
    if (typeof response !== 'number') {
      throw new ServiceUnavailableException('Redis cache returned an invalid delete response');
    }
    return response;
  }
  async keys(pattern: string): Promise<string[]> {
    if (!this.enabled) {
      return [];
    }
    const response = await this.runCommand(['KEYS', pattern]);
    if (!Array.isArray(response) || response.some((value) => typeof value !== 'string')) {
      throw new ServiceUnavailableException('Redis cache returned an invalid keys response');
    }
    return response as string[];
  }
  async onModuleDestroy(): Promise<void> {
    if (!this.socket || this.socket.destroyed) {
      return;
    }
    this.socket.destroy();
    this.socket = null;
    this.readBuffer = Buffer.alloc(0);
    this.rejectPending(new Error('Redis cache connection closed'));
  }
  private async runCommand(parts: string[]): Promise<RedisReply> {
    try {
      await this.ensureConnected();
      return await this.sendCommand(parts);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException(
        error instanceof Error ? error.message : 'Redis cache is unavailable',
      );
    }
  }
  private async ensureConnected(): Promise<void> {
    if (!this.enabled) {
      return;
    }
    if (this.socket && !this.socket.destroyed && this.socket.writable) {
      return;
    }
    if (!this.connectPromise) {
      this.connectPromise = this.openConnection().finally(() => {
        this.connectPromise = null;
      });
    }
    await this.connectPromise;
  }
  private async openConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = this.createSocket();
      const rejectConnection = (error: Error): void => {
        this.handleSocketTermination(socket, error);
        reject(error);
      };
      socket.setTimeout(this.connectTimeoutMs, () => {
        socket.destroy(new Error('Redis cache connection timed out'));
      });
      socket.once('error', rejectConnection);
      socket.once('close', () => {
        rejectConnection(new Error('Redis cache connection closed before initialization'));
      });
      socket.once('connect', async () => {
        socket.setTimeout(0);
        socket.off('error', rejectConnection);
        socket.removeAllListeners('close');
        socket.on('data', (chunk) => this.handleData(chunk));
        socket.on('error', (error) => this.handleSocketTermination(socket, error));
        socket.on('close', () => this.handleSocketTermination(socket));
        this.socket = socket;
        this.readBuffer = Buffer.alloc(0);
        try {
          await this.initializeConnection();
          resolve();
        } catch (error) {
          const connectionError =
            error instanceof Error ? error : new Error('Redis cache initialization failed');
          this.handleSocketTermination(socket, connectionError);
          socket.destroy(connectionError);
          reject(connectionError);
        }
      });
    });
  }
  private createSocket(): Socket | TLSSocket {
    if (this.tlsEnabled) {
      return createTlsConnection({
        host: this.host,
        port: this.port,
        servername: this.host,
      });
    }
    return createConnection({
      host: this.host,
      port: this.port,
    });
  }
  private async initializeConnection(): Promise<void> {
    if (this.password) {
      const authCommand = this.username
        ? ['AUTH', this.username, this.password]
        : ['AUTH', this.password];
      const authResponse = await this.sendCommand(authCommand);
      if (authResponse !== 'OK') {
        throw new Error('Redis cache authentication failed');
      }
    }
    if (this.database > 0) {
      const selectResponse = await this.sendCommand(['SELECT', this.database.toString()]);
      if (selectResponse !== 'OK') {
        throw new Error('Redis cache database selection failed');
      }
    }
  }
  private async sendCommand(parts: string[]): Promise<RedisReply> {
    const socket = this.socket;
    if (!socket || socket.destroyed || !socket.writable) {
      throw new Error('Redis cache connection is not ready');
    }
    return new Promise<RedisReply>((resolve, reject) => {
      this.pendingResponses.push({ resolve, reject });
      socket.write(this.encodeCommand(parts));
    });
  }
  private encodeCommand(parts: string[]): Buffer {
    const encodedParts = parts.map((part) => {
      const value = part ?? '';
      return `$${Buffer.byteLength(value, 'utf8')}\r\n${value}\r\n`;
    });
    return Buffer.from(`*${parts.length}\r\n${encodedParts.join('')}`, 'utf8');
  }
  private handleData(chunk: Buffer): void {
    this.readBuffer = Buffer.concat([this.readBuffer, chunk]);
    while (this.readBuffer.length > 0) {
      const parsedReply = this.parseReply(this.readBuffer, 0);
      if (!parsedReply) {
        return;
      }
      this.readBuffer = this.readBuffer.subarray(parsedReply.nextOffset);
      const pendingResponse = this.pendingResponses.shift();
      if (!pendingResponse) {
        continue;
      }
      if (parsedReply.isError) {
        pendingResponse.reject(new Error(String(parsedReply.value)));
        continue;
      }
      pendingResponse.resolve(parsedReply.value);
    }
  }
  private parseReply(buffer: Buffer, offset: number): ParsedRedisReply | null {
    if (offset >= buffer.length) {
      return null;
    }
    const prefix = String.fromCharCode(buffer[offset]);
    switch (prefix) {
      case '+':
        return this.parseSimpleString(buffer, offset + 1, false);
      case '-':
        return this.parseSimpleString(buffer, offset + 1, true);
      case ':':
        return this.parseInteger(buffer, offset + 1);
      case '$':
        return this.parseBulkString(buffer, offset + 1);
      case '*':
        return this.parseArray(buffer, offset + 1);
      default:
        throw new Error(`Unsupported Redis response prefix: ${prefix}`);
    }
  }
  private parseSimpleString(
    buffer: Buffer,
    offset: number,
    isError: boolean,
  ): ParsedRedisReply | null {
    const line = this.readLine(buffer, offset);
    if (!line) {
      return null;
    }
    return {
      value: line.value,
      isError,
      nextOffset: line.nextOffset,
    };
  }
  private parseInteger(buffer: Buffer, offset: number): ParsedRedisReply | null {
    const line = this.readLine(buffer, offset);
    if (!line) {
      return null;
    }
    return {
      value: Number.parseInt(line.value, 10),
      isError: false,
      nextOffset: line.nextOffset,
    };
  }
  private parseBulkString(buffer: Buffer, offset: number): ParsedRedisReply | null {
    const line = this.readLine(buffer, offset);
    if (!line) {
      return null;
    }
    const byteLength = Number.parseInt(line.value, 10);
    if (byteLength === -1) {
      return {
        value: null,
        isError: false,
        nextOffset: line.nextOffset,
      };
    }
    const endOffset = line.nextOffset + byteLength;
    if (buffer.length < endOffset + 2) {
      return null;
    }
    if (buffer[endOffset] !== 13 || buffer[endOffset + 1] !== 10) {
      throw new Error('Invalid Redis bulk string terminator');
    }
    return {
      value: buffer.subarray(line.nextOffset, endOffset).toString('utf8'),
      isError: false,
      nextOffset: endOffset + 2,
    };
  }
  private parseArray(buffer: Buffer, offset: number): ParsedRedisReply | null {
    const line = this.readLine(buffer, offset);
    if (!line) {
      return null;
    }
    const itemCount = Number.parseInt(line.value, 10);
    if (itemCount === -1) {
      return {
        value: null,
        isError: false,
        nextOffset: line.nextOffset,
      };
    }
    const values: RedisReply[] = [];
    let nextOffset = line.nextOffset;
    for (let index = 0; index < itemCount; index += 1) {
      const parsedItem = this.parseReply(buffer, nextOffset);
      if (!parsedItem) {
        return null;
      }
      if (parsedItem.isError) {
        return parsedItem;
      }
      values.push(parsedItem.value);
      nextOffset = parsedItem.nextOffset;
    }
    return {
      value: values,
      isError: false,
      nextOffset,
    };
  }
  private readLine(
    buffer: Buffer,
    offset: number,
  ): { value: string; nextOffset: number } | null {
    const lineEndIndex = buffer.indexOf('\r\n', offset, 'utf8');
    if (lineEndIndex === -1) {
      return null;
    }
    return {
      value: buffer.subarray(offset, lineEndIndex).toString('utf8'),
      nextOffset: lineEndIndex + 2,
    };
  }
  private handleSocketTermination(socket: Socket | TLSSocket, error?: Error): void {
    if (this.socket === socket) {
      this.socket = null;
    }
    if (!socket.destroyed) {
      socket.destroy();
    }
    this.readBuffer = Buffer.alloc(0);
    this.rejectPending(error ?? new Error('Redis cache connection closed'));
  }
  private rejectPending(error: Error): void {
    while (this.pendingResponses.length > 0) {
      const pendingResponse = this.pendingResponses.shift();
      pendingResponse?.reject(error);
    }
  }
}
