"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisCacheService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_net_1 = require("node:net");
const node_tls_1 = require("node:tls");
let RedisCacheService = class RedisCacheService {
    configService;
    enabled;
    host;
    port;
    username;
    password;
    database;
    tlsEnabled;
    connectTimeoutMs;
    socket = null;
    connectPromise = null;
    readBuffer = Buffer.alloc(0);
    pendingResponses = [];
    constructor(configService) {
        this.configService = configService;
        this.enabled = this.configService.get('redis.enabled', false);
        this.host = this.configService.get('redis.host', '127.0.0.1');
        this.port = this.configService.get('redis.port', 6379);
        this.username = this.configService.get('redis.username', '');
        this.password = this.configService.get('redis.password', '');
        this.database = this.configService.get('redis.db', 0);
        this.tlsEnabled = this.configService.get('redis.tls', false);
        this.connectTimeoutMs = this.configService.get('redis.connectTimeoutMs', 5000);
    }
    isEnabled() {
        return this.enabled;
    }
    async ping() {
        if (!this.enabled) {
            return 'DISABLED';
        }
        const response = await this.runCommand(['PING']);
        if (response !== 'PONG') {
            throw new common_1.ServiceUnavailableException('Redis cache returned an invalid health response');
        }
        return 'PONG';
    }
    async get(key) {
        if (!this.enabled) {
            return null;
        }
        const response = await this.runCommand(['GET', key]);
        if (response === null) {
            return null;
        }
        if (typeof response !== 'string') {
            throw new common_1.ServiceUnavailableException('Redis cache returned an invalid string response');
        }
        return response;
    }
    async set(key, value, ttlSeconds) {
        if (!this.enabled) {
            return;
        }
        const command = ['SET', key, value];
        if (ttlSeconds !== undefined && ttlSeconds !== null) {
            const normalizedTtl = Math.max(1, Math.floor(ttlSeconds));
            command.push('EX', normalizedTtl.toString());
        }
        const response = await this.runCommand(command);
        if (response !== 'OK') {
            throw new common_1.ServiceUnavailableException('Redis cache failed to persist the value');
        }
    }
    async del(key) {
        if (!this.enabled) {
            return 0;
        }
        const response = await this.runCommand(['DEL', key]);
        if (typeof response !== 'number') {
            throw new common_1.ServiceUnavailableException('Redis cache returned an invalid delete response');
        }
        return response;
    }
    async delMany(keys) {
        if (!this.enabled || keys.length === 0) {
            return 0;
        }
        const response = await this.runCommand(['DEL', ...keys]);
        if (typeof response !== 'number') {
            throw new common_1.ServiceUnavailableException('Redis cache returned an invalid delete response');
        }
        return response;
    }
    async keys(pattern) {
        if (!this.enabled) {
            return [];
        }
        const response = await this.runCommand(['KEYS', pattern]);
        if (!Array.isArray(response) || response.some((value) => typeof value !== 'string')) {
            throw new common_1.ServiceUnavailableException('Redis cache returned an invalid keys response');
        }
        return response;
    }
    async onModuleDestroy() {
        if (!this.socket || this.socket.destroyed) {
            return;
        }
        this.socket.destroy();
        this.socket = null;
        this.readBuffer = Buffer.alloc(0);
        this.rejectPending(new Error('Redis cache connection closed'));
    }
    async runCommand(parts) {
        try {
            await this.ensureConnected();
            return await this.sendCommand(parts);
        }
        catch (error) {
            if (error instanceof common_1.ServiceUnavailableException) {
                throw error;
            }
            throw new common_1.ServiceUnavailableException(error instanceof Error ? error.message : 'Redis cache is unavailable');
        }
    }
    async ensureConnected() {
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
    async openConnection() {
        return new Promise((resolve, reject) => {
            const socket = this.createSocket();
            const rejectConnection = (error) => {
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
                }
                catch (error) {
                    const connectionError = error instanceof Error ? error : new Error('Redis cache initialization failed');
                    this.handleSocketTermination(socket, connectionError);
                    socket.destroy(connectionError);
                    reject(connectionError);
                }
            });
        });
    }
    createSocket() {
        if (this.tlsEnabled) {
            return (0, node_tls_1.connect)({
                host: this.host,
                port: this.port,
                servername: this.host,
            });
        }
        return (0, node_net_1.createConnection)({
            host: this.host,
            port: this.port,
        });
    }
    async initializeConnection() {
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
    async sendCommand(parts) {
        const socket = this.socket;
        if (!socket || socket.destroyed || !socket.writable) {
            throw new Error('Redis cache connection is not ready');
        }
        return new Promise((resolve, reject) => {
            this.pendingResponses.push({ resolve, reject });
            socket.write(this.encodeCommand(parts));
        });
    }
    encodeCommand(parts) {
        const encodedParts = parts.map((part) => {
            const value = part ?? '';
            return `$${Buffer.byteLength(value, 'utf8')}\r\n${value}\r\n`;
        });
        return Buffer.from(`*${parts.length}\r\n${encodedParts.join('')}`, 'utf8');
    }
    handleData(chunk) {
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
    parseReply(buffer, offset) {
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
    parseSimpleString(buffer, offset, isError) {
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
    parseInteger(buffer, offset) {
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
    parseBulkString(buffer, offset) {
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
    parseArray(buffer, offset) {
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
        const values = [];
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
    readLine(buffer, offset) {
        const lineEndIndex = buffer.indexOf('\r\n', offset, 'utf8');
        if (lineEndIndex === -1) {
            return null;
        }
        return {
            value: buffer.subarray(offset, lineEndIndex).toString('utf8'),
            nextOffset: lineEndIndex + 2,
        };
    }
    handleSocketTermination(socket, error) {
        if (this.socket === socket) {
            this.socket = null;
        }
        if (!socket.destroyed) {
            socket.destroy();
        }
        this.readBuffer = Buffer.alloc(0);
        this.rejectPending(error ?? new Error('Redis cache connection closed'));
    }
    rejectPending(error) {
        while (this.pendingResponses.length > 0) {
            const pendingResponse = this.pendingResponses.shift();
            pendingResponse?.reject(error);
        }
    }
};
exports.RedisCacheService = RedisCacheService;
exports.RedisCacheService = RedisCacheService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], RedisCacheService);
//# sourceMappingURL=redis-cache.service.js.map