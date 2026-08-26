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
var DynamicDatasetSource_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicDatasetSource = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const configured_grid_sql_service_1 = require("../../../../common/configured-grid-sql/configured-grid-sql.service");
const pg_service_1 = require("../../../../database/pg/pg.service");
const prisma_service_1 = require("../../../../database/prisma/prisma.service");
const sql_report_dataset_provider_1 = require("./sql-report-dataset.provider");
const DEFAULT_REFRESH_MS = 30_000;
let DynamicDatasetSource = DynamicDatasetSource_1 = class DynamicDatasetSource {
    prisma;
    pg;
    configuredGridSql;
    config;
    logger = new common_1.Logger(DynamicDatasetSource_1.name);
    providers = new Map();
    descriptors = new Map();
    signature = '';
    timer = null;
    constructor(prisma, pg, configuredGridSql, config) {
        this.prisma = prisma;
        this.pg = pg;
        this.configuredGridSql = configuredGridSql;
        this.config = config;
    }
    async onModuleInit() {
        let loaded = true;
        try {
            await this.refresh();
        }
        catch (error) {
            loaded = false;
            this.logger.error('Runtime report datasets could not be loaded — serving none. ' +
                'Templates binding a custom.* dataset will fail at print time until this clears. ' +
                `Cause: ${error instanceof Error ? error.message : String(error)}`);
        }
        const intervalMs = Number(this.config.get('REPORT_DATASET_REFRESH_MS') ?? DEFAULT_REFRESH_MS);
        if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
            this.logger.log('Runtime dataset refresh polling disabled');
            if (!loaded) {
                this.logger.error('Polling is disabled and the initial load failed: runtime datasets stay empty for ' +
                    'the life of this process. Apply pending migrations and restart.');
            }
            return;
        }
        this.timer = setInterval(() => {
            void this.refreshIfChanged();
        }, intervalMs);
        this.timer.unref?.();
    }
    onModuleDestroy() {
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    has(token) {
        return this.providers.has(token.toLowerCase());
    }
    get(token) {
        return this.providers.get(token.toLowerCase());
    }
    list(docType) {
        const all = [...this.descriptors.values()];
        if (docType === undefined) {
            return all;
        }
        return all.filter((descriptor) => descriptor.docTypes.length === 0 || descriptor.docTypes.includes(docType));
    }
    listTokens() {
        return [...this.providers.keys()];
    }
    async invalidate() {
        await this.refresh();
    }
    async refreshIfChanged() {
        try {
            const current = await this.readSignature();
            if (current === this.signature) {
                return;
            }
            this.logger.log('Runtime dataset definitions changed elsewhere — reloading');
            await this.refresh();
        }
        catch (error) {
            this.logger.error(`Runtime dataset refresh probe failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async readSignature() {
        const probe = await this.prisma.reportDataset.aggregate({
            where: { rdsIsDeleted: false, rdsIsActive: true },
            _count: { rdsId: true },
            _max: { rdsVersion: true, rdsModifiedOn: true, rdsCreatedOn: true },
        });
        return [
            probe._count.rdsId,
            probe._max.rdsVersion ?? 0,
            probe._max.rdsModifiedOn?.toISOString() ?? '',
            probe._max.rdsCreatedOn?.toISOString() ?? '',
        ].join('|');
    }
    async refresh() {
        const rows = await this.prisma.reportDataset.findMany({
            where: { rdsIsDeleted: false, rdsIsActive: true },
            orderBy: { rdsToken: 'asc' },
        });
        const providers = new Map();
        const descriptors = new Map();
        for (const row of rows) {
            const definition = this.toDefinition(row);
            const key = definition.token.toLowerCase();
            providers.set(key, new sql_report_dataset_provider_1.SqlReportDatasetProvider(definition, this.pg, this.configuredGridSql));
            descriptors.set(key, {
                token: definition.token,
                label: definition.label,
                cardinality: definition.cardinality,
                docTypes: definition.docTypes,
                fields: definition.fields,
            });
        }
        this.providers = providers;
        this.descriptors = descriptors;
        this.signature = await this.readSignature();
        this.logger.log(`Loaded ${providers.size} runtime report dataset(s)`);
    }
    toDefinition(row) {
        return {
            id: row.rdsId,
            token: row.rdsToken,
            label: row.rdsLabel,
            cardinality: row.rdsCardinality === 'one' ? 'one' : 'many',
            docTypes: row.rdsDocTypes,
            sql: row.rdsSql,
            params: row.rdsParams ?? [],
            fields: row.rdsFields ?? [],
            sampleRows: row.rdsSampleRows ?? null,
            maxRows: row.rdsMaxRows,
            version: row.rdsVersion,
        };
    }
};
exports.DynamicDatasetSource = DynamicDatasetSource;
exports.DynamicDatasetSource = DynamicDatasetSource = DynamicDatasetSource_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        pg_service_1.PgService,
        configured_grid_sql_service_1.ConfiguredGridSqlService,
        config_1.ConfigService])
], DynamicDatasetSource);
//# sourceMappingURL=dynamic-dataset.source.js.map