import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { AddressInfo, Server, Socket, createServer } from 'node:net';
import { RedisCacheService } from './redis-cache.service';

/**
 * A just-enough Redis on a local port: it parses RESP commands and answers
 * PING, AUTH, SELECT, GET, SET, DEL and KEYS from a Map. A command can be
 * given a scripted raw reply, or `null` to never answer it.
 */
class FakeRedis {
  readonly data = new Map<string, string>();
  readonly commands: string[][] = [];
  readonly scripted = new Map<string, string | null>();
  /** When set, each reply is written one byte at a time. */
  dribble = false;
  password = '';
  username = '';
  connections = 0;
  private readonly sockets = new Set<Socket>();
  private server!: Server;

  async start(): Promise<number> {
    this.server = createServer((socket) => {
      this.connections += 1;
      this.sockets.add(socket);
      socket.on('close', () => this.sockets.delete(socket));
      let buffer: Buffer = Buffer.alloc(0);
      socket.on('data', (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        let parsed: { parts: string[]; rest: Buffer } | null;
        while ((parsed = FakeRedis.parse(buffer))) {
          buffer = parsed.rest;
          this.commands.push(parsed.parts);
          const reply = this.answer(parsed.parts);
          if (reply !== null) this.write(socket, reply);
        }
      });
    });
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    return (this.server.address() as AddressInfo).port;
  }

  /** Drop every client connection, as a Redis restart would. */
  kick(): void {
    for (const socket of this.sockets) socket.destroy();
  }

  async stop(): Promise<void> {
    this.kick();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private write(socket: Socket, reply: string): void {
    if (!this.dribble) {
      socket.write(reply);
      return;
    }
    const bytes = Buffer.from(reply, 'utf8');
    bytes.forEach((_, i) => setTimeout(() => socket.write(bytes.subarray(i, i + 1)), i));
  }

  private answer([name, ...args]: string[]): string | null {
    if (this.scripted.has(name)) return this.scripted.get(name) ?? null;
    const bulk = (v: string) => `$${Buffer.byteLength(v)}\r\n${v}\r\n`;
    switch (name) {
      case 'PING':
        return '+PONG\r\n';
      case 'AUTH': {
        const [user, pass] = args.length === 2 ? args : ['', args[0]];
        return user === this.username && pass === this.password
          ? '+OK\r\n'
          : '-WRONGPASS invalid username-password pair\r\n';
      }
      case 'SELECT':
        return '+OK\r\n';
      case 'GET': {
        const v = this.data.get(args[0]);
        return v === undefined ? '$-1\r\n' : bulk(v);
      }
      case 'SET':
        this.data.set(args[0], args[1]);
        return '+OK\r\n';
      case 'DEL':
        return `:${args.filter((k) => this.data.delete(k)).length}\r\n`;
      case 'KEYS': {
        const prefix = args[0].replace(/\*$/, '');
        const keys = [...this.data.keys()].filter((k) => k.startsWith(prefix));
        return `*${keys.length}\r\n${keys.map(bulk).join('')}`;
      }
      default:
        return `-ERR unknown command '${name}'\r\n`;
    }
  }

  private static parse(buffer: Buffer): { parts: string[]; rest: Buffer } | null {
    let offset = 0;
    const line = () => {
      const end = buffer.indexOf('\r\n', offset);
      if (end === -1) return null;
      const text = buffer.subarray(offset, end).toString('utf8');
      offset = end + 2;
      return text;
    };
    const head = line();
    if (head === null) return null;
    const parts: string[] = [];
    for (let i = 0; i < Number(head.slice(1)); i += 1) {
      const size = line();
      if (size === null) return null;
      const length = Number(size.slice(1));
      if (buffer.length < offset + length + 2) return null;
      parts.push(buffer.subarray(offset, offset + length).toString('utf8'));
      offset += length + 2;
    }
    return { parts, rest: buffer.subarray(offset) };
  }
}

const configOf = (values: Record<string, unknown>) =>
  ({
    get: (key: string, fallback: unknown) => (key in values ? values[key] : fallback),
  }) as unknown as ConfigService;

describe('RedisCacheService', () => {
  describe('when disabled', () => {
    // Port 1 would refuse a connection: these must never try one.
    const service = new RedisCacheService(configOf({ 'redis.port': 1 }));

    it('answers every call without touching the network', async () => {
      expect(service.isEnabled()).toBe(false);
      await expect(service.ping()).resolves.toBe('DISABLED');
      await expect(service.get('k')).resolves.toBeNull();
      await expect(service.set('k', 'v', 10)).resolves.toBeUndefined();
      await expect(service.del('k')).resolves.toBe(0);
      await expect(service.delMany(['k'])).resolves.toBe(0);
      await expect(service.keys('*')).resolves.toEqual([]);
    });
  });

  describe('against a live connection', () => {
    let redis: FakeRedis;
    let port: number;
    let service: RedisCacheService;

    const connect = (extra: Record<string, unknown> = {}) =>
      new RedisCacheService(
        configOf({ 'redis.enabled': true, 'redis.host': '127.0.0.1', 'redis.port': port, ...extra }),
      );

    beforeEach(async () => {
      redis = new FakeRedis();
      port = await redis.start();
      service = connect();
    });

    afterEach(async () => {
      service.onModuleDestroy();
      await redis.stop();
    });

    it('pings', async () => {
      await expect(service.ping()).resolves.toBe('PONG');
    });

    it('refuses a ping that does not answer PONG', async () => {
      redis.scripted.set('PING', '+NOPE\r\n');

      await expect(service.ping()).rejects.toThrow(
        'Redis cache returned an invalid health response',
      );
    });

    it('sets and gets a value', async () => {
      await service.set('greeting', 'hello');

      await expect(service.get('greeting')).resolves.toBe('hello');
      expect(redis.commands).toEqual([
        ['SET', 'greeting', 'hello'],
        ['GET', 'greeting'],
      ]);
    });

    it('counts multi-byte text in bytes, not characters', async () => {
      const text = 'தமிழ் ₹ 1,000 — ok';

      await service.set('k', text);

      await expect(service.get('k')).resolves.toBe(text);
    });

    it('answers null for a missing key', async () => {
      await expect(service.get('nope')).resolves.toBeNull();
    });

    it('sends a ttl as whole seconds, never below 1', async () => {
      await service.set('a', '1', 90.9);
      await service.set('b', '1', 0.2);
      await service.set('c', '1', null);

      expect(redis.commands).toEqual([
        ['SET', 'a', '1', 'EX', '90'],
        ['SET', 'b', '1', 'EX', '1'],
        ['SET', 'c', '1'],
      ]);
    });

    it('refuses a SET that is not acknowledged', async () => {
      redis.scripted.set('SET', '$-1\r\n');

      await expect(service.set('k', 'v')).rejects.toThrow(
        'Redis cache failed to persist the value',
      );
    });

    it('deletes one key or many and returns the count', async () => {
      redis.data.set('a', '1');
      redis.data.set('b', '2');
      redis.data.set('c', '3');

      await expect(service.del('a')).resolves.toBe(1);
      await expect(service.del('a')).resolves.toBe(0);
      await expect(service.delMany(['b', 'c', 'zz'])).resolves.toBe(2);
    });

    it('does not send DEL for an empty key list', async () => {
      await expect(service.delMany([])).resolves.toBe(0);

      expect(redis.commands).toEqual([]);
    });

    it('lists keys by pattern', async () => {
      redis.data.set('http-cache:/items', 'x');
      redis.data.set('http-cache:/units', 'y');
      redis.data.set('session:1', 'z');

      await expect(service.keys('http-cache:*')).resolves.toEqual([
        'http-cache:/items',
        'http-cache:/units',
      ]);
    });

    it('refuses a reply of the wrong type', async () => {
      redis.scripted.set('GET', ':5\r\n');
      redis.scripted.set('DEL', '+OK\r\n');
      redis.scripted.set('KEYS', '*1\r\n:1\r\n');

      await expect(service.get('k')).rejects.toThrow('invalid string response');
      await expect(service.del('k')).rejects.toThrow('invalid delete response');
      await expect(service.delMany(['k'])).rejects.toThrow('invalid delete response');
      await expect(service.keys('*')).rejects.toThrow('invalid keys response');
    });

    it('turns a Redis error reply into a 503 carrying its text', async () => {
      redis.scripted.set('GET', '-WRONGTYPE Operation against a key\r\n');

      const result = service.get('k');

      await expect(result).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(result).rejects.toThrow('WRONGTYPE Operation against a key');
    });

    it('reads a reply that arrives one byte at a time', async () => {
      redis.data.set('k', 'split across many packets');
      redis.data.set('http-cache:a', '1');
      redis.dribble = true;

      await expect(service.get('k')).resolves.toBe('split across many packets');
      await expect(service.keys('http-cache:*')).resolves.toEqual(['http-cache:a']);
    });

    it('matches pipelined replies to their commands in order', async () => {
      redis.data.set('a', 'A');
      redis.data.set('b', 'B');

      await expect(
        Promise.all([service.get('a'), service.get('b'), service.get('c'), service.ping()]),
      ).resolves.toEqual(['A', 'B', null, 'PONG']);
      expect(redis.connections).toBe(1);
    });

    it('reconnects after the server drops the connection', async () => {
      await service.ping();
      redis.kick();
      await new Promise((resolve) => setTimeout(resolve, 20));

      await expect(service.ping()).resolves.toBe('PONG');
      expect(redis.connections).toBe(2);
    });

    it('fails a command still waiting when the module shuts down', async () => {
      redis.scripted.set('GET', null);
      const waiting = service.get('k');
      await new Promise((resolve) => setTimeout(resolve, 20));

      service.onModuleDestroy();

      await expect(waiting).rejects.toThrow('Redis cache connection closed');
    });

    describe('on connect', () => {
      it('authenticates with the password alone', async () => {
        redis.password = 's3cret';
        service = connect({ 'redis.password': 's3cret' });

        await service.ping();

        expect(redis.commands[0]).toEqual(['AUTH', 's3cret']);
      });

      it('authenticates with an ACL user and password', async () => {
        redis.username = 'erp';
        redis.password = 's3cret';
        service = connect({ 'redis.username': 'erp', 'redis.password': 's3cret' });

        await service.ping();

        expect(redis.commands[0]).toEqual(['AUTH', 'erp', 's3cret']);
      });

      it('fails the command when the password is wrong', async () => {
        redis.password = 'right';
        service = connect({ 'redis.password': 'wrong' });

        await expect(service.ping()).rejects.toThrow('WRONGPASS');
      });

      it('selects a database above 0, and not database 0', async () => {
        service = connect({ 'redis.db': 3 });
        await service.ping();
        expect(redis.commands[0]).toEqual(['SELECT', '3']);

        service.onModuleDestroy();
        redis.commands.length = 0;
        service = connect({ 'redis.db': 0 });
        await service.ping();
        expect(redis.commands).toEqual([['PING']]);
      });
    });
  });

  it('answers 503 when nothing listens on the port', async () => {
    const probe = new FakeRedis();
    const port = await probe.start();
    await probe.stop();
    const service = new RedisCacheService(
      configOf({ 'redis.enabled': true, 'redis.host': '127.0.0.1', 'redis.port': port }),
    );

    await expect(service.ping()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
