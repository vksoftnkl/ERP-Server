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
exports.GstProviderService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const gst_config_constants_1 = require("./gst-config.constants");
const gst_config_mappers_1 = require("./gst-config.mappers");
const gst_config_support_1 = require("./gst-config.support");
const TABLE = 'gst provider';
const SCREEN = 'GST Provider';
let GstProviderService = class GstProviderService {
    prisma;
    support;
    constructor(prisma, support) {
        this.prisma = prisma;
        this.support = support;
    }
    async getById(gpvId) {
        await this.support.requireRight(gst_config_constants_1.GST_PROVIDERS_MENU, 'view', 'view GST providers');
        const row = await this.prisma.gstProvider.findUnique({ where: { gpvId } });
        if (!row) {
            this.support.notFound('gpvId', 'GST provider', gpvId);
        }
        return this.load(this.prisma, row);
    }
    async save(dto) {
        const creating = dto.gpvId === undefined;
        await this.support.requireRight(gst_config_constants_1.GST_PROVIDERS_MENU, creating ? 'create' : 'edit', creating ? 'create GST providers' : 'edit GST providers');
        const actor = this.support.actor();
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = creating
                    ? null
                    : await tx.gstProvider.findUnique({ where: { gpvId: dto.gpvId } });
                if (!creating && !existing) {
                    this.support.notFound('gpvId', 'GST provider', dto.gpvId);
                }
                if (existing?.gpvIsDeleted) {
                    this.support.refuseDeleted('gpvId', 'GST provider', existing.gpvId);
                }
                if (existing && existing.gpvCode !== dto.gpvCode) {
                    this.support.conflict('A provider code is never renamed', 'gpvCode', `This provider is ${existing.gpvCode}. Retire it and create ${dto.gpvCode} instead.`, gst_config_constants_1.GST_CODES.PROVIDER_CODE_FIXED);
                }
                if (creating) {
                    await this.assertCodeIsFree(tx, dto.gpvCode);
                }
                const data = {
                    gpvName: dto.gpvName,
                    gpvPortalUrl: (0, gst_config_support_1.keep)(dto.gpvPortalUrl, existing?.gpvPortalUrl, null),
                    gpvSupportEmail: (0, gst_config_support_1.keep)(dto.gpvSupportEmail, existing?.gpvSupportEmail, null),
                    gpvSupportPhone: (0, gst_config_support_1.keep)(dto.gpvSupportPhone, existing?.gpvSupportPhone, null),
                    gpvTimeoutMs: (0, gst_config_support_1.keep)(dto.gpvTimeoutMs, existing?.gpvTimeoutMs, 30000),
                    gpvMaxRetries: (0, gst_config_support_1.keep)(dto.gpvMaxRetries, existing?.gpvMaxRetries, 2),
                    gpvRateLimitPerMin: (0, gst_config_support_1.keep)(dto.gpvRateLimitPerMin, existing?.gpvRateLimitPerMin, null),
                    gpvRemarks: (0, gst_config_support_1.keep)(dto.gpvRemarks, existing?.gpvRemarks, null),
                    gpvIsActive: (0, gst_config_support_1.keep)(dto.gpvIsActive, existing?.gpvIsActive, true),
                };
                const saved = existing
                    ? await tx.gstProvider.update({
                        where: { gpvId: existing.gpvId },
                        data: { ...data, gpvModifiedOn: new Date(), gpvModifiedBy: actor },
                    })
                    : await tx.gstProvider.create({
                        data: { ...data, gpvCode: dto.gpvCode, gpvCreatedBy: actor },
                    });
                await this.support.audit(tx, {
                    action: existing ? 'update' : 'New',
                    table: TABLE,
                    screen: SCREEN,
                    pk: saved.gpvId,
                    displayName: saved.gpvCode,
                    before: existing ? (0, gst_config_mappers_1.toProviderAuditRecord)(existing) : null,
                    after: (0, gst_config_mappers_1.toProviderAuditRecord)(saved),
                    notes: existing ? 'GST provider updated' : 'GST provider created',
                });
                return this.load(tx, saved);
            });
        }
        catch (error) {
            this.support.translateWriteError(error, [
                {
                    match: ['gpv_code'],
                    field: 'gpvCode',
                    message: `Provider code ${dto.gpvCode} is taken (by a deleted provider, perhaps).`,
                    code: gst_config_constants_1.GST_CODES.PROVIDER_CODE_DUPLICATE,
                },
            ]);
            throw error;
        }
    }
    async softDelete(gpvId) {
        await this.support.requireRight(gst_config_constants_1.GST_PROVIDERS_MENU, 'delete', 'delete GST providers');
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.gstProvider.findUnique({ where: { gpvId } });
            if (!existing) {
                this.support.notFound('gpvId', 'GST provider', gpvId);
            }
            if (existing.gpvIsDeleted) {
                this.support.conflict('GST provider is already deleted', 'gpvId', 'Nothing to delete. POST /gst/providers/restore brings it back.', gst_config_constants_1.GST_CODES.ALREADY_DELETED);
            }
            const credentials = await this.credentialCount(tx, gpvId);
            if (credentials > 0) {
                this.support.conflict('GST provider is in use', 'gpvId', `${credentials} live company credential${credentials === 1 ? '' : 's'} sign${credentials === 1 ? 's' : ''} in through ${existing.gpvCode}. Delete or repoint ${credentials === 1 ? 'it' : 'them'} first.`, gst_config_constants_1.GST_CODES.PROVIDER_IN_USE);
            }
            await this.setDeleted(tx, existing, true);
            return { gpvId, deleted: true };
        });
    }
    async restore(gpvId) {
        await this.support.requireRight(gst_config_constants_1.GST_PROVIDERS_MENU, 'edit', 'restore GST providers');
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.gstProvider.findUnique({ where: { gpvId } });
            if (!existing) {
                this.support.notFound('gpvId', 'GST provider', gpvId);
            }
            if (!existing.gpvIsDeleted) {
                this.support.conflict('GST provider is not deleted', 'gpvId', 'Nothing to restore.', gst_config_constants_1.GST_CODES.NOT_DELETED);
            }
            await this.setDeleted(tx, existing, false);
            return { gpvId, deleted: false };
        });
    }
    async setDeleted(tx, existing, deleted) {
        const updated = await tx.gstProvider.update({
            where: { gpvId: existing.gpvId },
            data: {
                gpvIsDeleted: deleted,
                gpvModifiedOn: new Date(),
                gpvModifiedBy: this.support.actor(),
            },
        });
        await this.support.audit(tx, {
            action: deleted ? 'cancel' : 'update',
            table: TABLE,
            screen: SCREEN,
            pk: existing.gpvId,
            displayName: existing.gpvCode,
            before: (0, gst_config_mappers_1.toProviderAuditRecord)(existing),
            after: (0, gst_config_mappers_1.toProviderAuditRecord)(updated),
            notes: deleted ? 'GST provider soft deleted' : 'GST provider restored',
        });
    }
    async assertCodeIsFree(tx, gpvCode) {
        const clash = await tx.gstProvider.findUnique({
            where: { gpvCode },
            select: { gpvId: true, gpvIsDeleted: true },
        });
        if (clash) {
            this.support.conflict('GST provider code already exists', 'gpvCode', clash.gpvIsDeleted
                ? `${gpvCode} belongs to deleted provider ${clash.gpvId}. Restore it instead.`
                : `${gpvCode} is provider ${clash.gpvId}.`, gst_config_constants_1.GST_CODES.PROVIDER_CODE_DUPLICATE);
        }
    }
    credentialCount(client, gpvId) {
        return client.gstCompanyCredential.count({
            where: { gccGpvId: gpvId, gccIsDeleted: false },
        });
    }
    async load(client, row) {
        const [services, accounts, errorMapCount, credentialCount] = await Promise.all([
            client.gstProviderService.findMany({
                where: { gpsGpvId: row.gpvId, gpsIsDeleted: false },
                orderBy: [{ gpsService: 'asc' }, { gpsEnvironment: 'asc' }],
            }),
            client.gstProviderAccount.findMany({
                where: { gpaGpvId: row.gpvId, gpaIsDeleted: false },
                orderBy: [{ gpaEnvironment: 'asc' }, { gpaService: { sort: 'asc', nulls: 'first' } }],
            }),
            client.gstProviderErrorMap.count({ where: { gemGpvId: row.gpvId, gemIsDeleted: false } }),
            this.credentialCount(client, row.gpvId),
        ]);
        const endpointCounts = services.length
            ? await client.gstProviderEndpoint.groupBy({
                by: ['gpeGpsId'],
                where: { gpeGpsId: { in: services.map((s) => s.gpsId) }, gpeIsDeleted: false },
                _count: { _all: true },
            })
            : [];
        const endpointsOf = new Map(endpointCounts.map((c) => [c.gpeGpsId, c._count._all]));
        return (0, gst_config_mappers_1.toProviderPayload)(row, {
            services: services.map((s) => (0, gst_config_mappers_1.toServicePayload)(s, endpointsOf.get(s.gpsId) ?? 0)),
            accounts: accounts.map((a) => (0, gst_config_mappers_1.toAccountPayload)(a, row.gpvCode)),
            endpointCount: [...endpointsOf.values()].reduce((sum, n) => sum + n, 0),
            errorMapCount,
            credentialCount,
        });
    }
};
exports.GstProviderService = GstProviderService;
exports.GstProviderService = GstProviderService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        gst_config_support_1.GstConfigSupport])
], GstProviderService);
//# sourceMappingURL=gst-provider.service.js.map