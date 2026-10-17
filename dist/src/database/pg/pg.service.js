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
var PgService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PgService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const pg_1 = require("pg");
const DATE_AS_TEXT = {
    getTypeParser: (oid, format) => oid === pg_1.types.builtins.DATE
        ? (value) => value
        : pg_1.types.getTypeParser(oid, format),
};
let PgService = PgService_1 = class PgService {
    logger = new common_1.Logger(PgService_1.name);
    pool;
    readOnlyPool;
    constructor(configService) {
        const connectionString = configService.get('database.url');
        this.pool = new pg_1.Pool({
            ...(connectionString ? { connectionString } : {}),
            types: DATE_AS_TEXT,
        });
        const readOnlyConnectionString = configService.get('database.readOnlyUrl') || connectionString;
        this.readOnlyPool = new pg_1.Pool({
            ...(readOnlyConnectionString ? { connectionString: readOnlyConnectionString } : {}),
            options: '-c default_transaction_read_only=on',
            types: DATE_AS_TEXT,
        });
        if (!configService.get('database.readOnlyUrl')) {
            this.logger.warn('DATABASE_READONLY_URL is not set — configured grid/dropdown SQL runs under the primary DB role with session-level read-only enforcement only. Configure a dedicated read-only role for defense in depth.');
        }
    }
    query(text, params) {
        return this.pool.query(text, params);
    }
    queryReadOnly(text, params) {
        return this.readOnlyPool.query(text, params);
    }
    async queryReadOnlyTx(text, params, timeoutMs) {
        const client = await this.readOnlyPool.connect();
        try {
            await client.query('BEGIN READ ONLY');
            await client.query(`SET LOCAL statement_timeout = ${Math.trunc(timeoutMs)}`);
            const result = await client.query(text, params);
            await client.query('COMMIT');
            return result;
        }
        catch (error) {
            try {
                await client.query('ROLLBACK');
            }
            catch {
            }
            throw error;
        }
        finally {
            client.release();
        }
    }
    async onModuleDestroy() {
        await Promise.all([this.pool.end(), this.readOnlyPool.end()]);
    }
};
exports.PgService = PgService;
exports.PgService = PgService = PgService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PgService);
//# sourceMappingURL=pg.service.js.map