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
exports.GstProviderAccountService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const gst_config_constants_1 = require("./gst-config.constants");
const gst_config_mappers_1 = require("./gst-config.mappers");
const gst_config_support_1 = require("./gst-config.support");
const TABLE = 'gst provider account';
const SCREEN = 'GST Provider Account';
const SECRETS = [
    { key: 'clientId', column: 'gpaClientIdEnc' },
    { key: 'clientSecret', column: 'gpaClientSecretEnc' },
    { key: 'apiKey', column: 'gpaApiKeyEnc' },
];
let GstProviderAccountService = class GstProviderAccountService {
    prisma;
    support;
    constructor(prisma, support) {
        this.prisma = prisma;
        this.support = support;
    }
    async getById(gpaId) {
        await this.support.requireRight(gst_config_constants_1.GST_PROVIDERS_MENU, 'view', 'view GST provider accounts');
        const row = await this.prisma.gstProviderAccount.findUnique({
            where: { gpaId },
            include: { provider: { select: { gpvCode: true } } },
        });
        if (!row) {
            this.support.notFound('gpaId', 'GST provider account', gpaId);
        }
        return (0, gst_config_mappers_1.toAccountPayload)(row, row.provider.gpvCode);
    }
    async save(dto) {
        const creating = dto.gpaId === undefined;
        await this.support.requireRight(gst_config_constants_1.GST_PROVIDERS_MENU, creating ? 'create' : 'edit', creating ? 'create GST provider accounts' : 'edit GST provider accounts');
        const actor = this.support.actor();
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = creating
                    ? null
                    : await tx.gstProviderAccount.findUnique({ where: { gpaId: dto.gpaId } });
                if (!creating && !existing) {
                    this.support.notFound('gpaId', 'GST provider account', dto.gpaId);
                }
                if (existing?.gpaIsDeleted) {
                    this.support.refuseDeleted('gpaId', 'GST provider account', existing.gpaId);
                }
                if (existing && existing.gpaGpvId !== dto.gpaGpvId) {
                    this.support.refuseParentChange('gpaGpvId', `provider ${existing.gpaGpvId}`);
                }
                const provider = await tx.gstProvider.findUnique({
                    where: { gpvId: dto.gpaGpvId },
                    select: { gpvCode: true, gpvIsDeleted: true },
                });
                if (!provider) {
                    this.support.notFound('gpaGpvId', 'GST provider', dto.gpaGpvId);
                }
                if (provider.gpvIsDeleted) {
                    this.support.refuseDeleted('gpaGpvId', 'GST provider', dto.gpaGpvId);
                }
                const service = (0, gst_config_support_1.keep)(dto.gpaService, existing?.gpaService, null);
                const validFrom = (0, gst_config_support_1.keep)((0, gst_config_support_1.toDateOnly)(dto.gpaValidFrom), existing?.gpaValidFrom, null);
                const validUpto = (0, gst_config_support_1.keep)((0, gst_config_support_1.toDateOnly)(dto.gpaValidUpto), existing?.gpaValidUpto, null);
                if (validFrom && validUpto && validFrom > validUpto) {
                    this.support.badRequest([
                        { field: 'gpaValidUpto', message: 'must not be before gpaValidFrom' },
                    ]);
                }
                const clash = await tx.gstProviderAccount.findFirst({
                    where: {
                        gpaGpvId: dto.gpaGpvId,
                        gpaEnvironment: dto.gpaEnvironment,
                        gpaService: service,
                        gpaIsDeleted: false,
                        ...(existing ? { gpaId: { not: existing.gpaId } } : {}),
                    },
                    select: { gpaId: true },
                });
                if (clash) {
                    this.duplicate(dto.gpaEnvironment, service, clash.gpaId);
                }
                const secrets = this.support.writeSecrets({
                    specs: SECRETS,
                    input: dto,
                    clear: dto.clear,
                    stored: existing
                        ? {
                            gpaClientIdEnc: existing.gpaClientIdEnc,
                            gpaClientSecretEnc: existing.gpaClientSecretEnc,
                            gpaApiKeyEnc: existing.gpaApiKeyEnc,
                        }
                        : null,
                    storedVersion: existing?.gpaKeyVersion ?? null,
                });
                const data = {
                    gpaEnvironment: dto.gpaEnvironment,
                    gpaService: service,
                    gpaAccountRef: dto.gpaAccountRef,
                    ...secrets.data,
                    gpaKeyVersion: secrets.keyVersion,
                    gpaValidFrom: validFrom,
                    gpaValidUpto: validUpto,
                    gpaRemarks: (0, gst_config_support_1.keep)(dto.gpaRemarks, existing?.gpaRemarks, null),
                    gpaIsActive: (0, gst_config_support_1.keep)(dto.gpaIsActive, existing?.gpaIsActive, true),
                };
                const saved = existing
                    ? await tx.gstProviderAccount.update({
                        where: { gpaId: existing.gpaId },
                        data: { ...data, gpaModifiedOn: new Date(), gpaModifiedBy: actor },
                    })
                    : await tx.gstProviderAccount.create({
                        data: { ...data, gpaGpvId: dto.gpaGpvId, gpaCreatedBy: actor },
                    });
                const cleared = (dto.clear ?? []).filter((key) => !secrets.written.includes(key));
                await this.support.audit(tx, {
                    action: existing ? 'update' : 'New',
                    table: TABLE,
                    screen: SCREEN,
                    pk: saved.gpaId,
                    displayName: `${provider.gpvCode} ${saved.gpaEnvironment} ${saved.gpaService ?? 'ALL'}`,
                    before: existing ? (0, gst_config_mappers_1.toAccountPayload)(existing, provider.gpvCode) : null,
                    after: (0, gst_config_mappers_1.toAccountPayload)(saved, provider.gpvCode),
                    notes: (existing ? 'GST provider account updated' : 'GST provider account created') +
                        (secrets.written.length ? `; secrets written: ${secrets.written.join(', ')}` : '') +
                        (cleared.length ? `; secrets cleared: ${cleared.join(', ')}` : ''),
                });
                return (0, gst_config_mappers_1.toAccountPayload)(saved, provider.gpvCode);
            });
        }
        catch (error) {
            this.support.translateWriteError(error, [
                {
                    match: ['ux_gpa_provider_env_service', 'gpa_environment'],
                    field: 'gpaEnvironment',
                    message: 'The provider already has a live account for that environment and service.',
                    code: gst_config_constants_1.GST_CODES.ACCOUNT_DUPLICATE,
                },
            ]);
            throw error;
        }
    }
    async softDelete(gpaId) {
        await this.support.requireRight(gst_config_constants_1.GST_PROVIDERS_MENU, 'delete', 'delete GST provider accounts');
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.gstProviderAccount.findUnique({
                where: { gpaId },
                include: { provider: { select: { gpvCode: true } } },
            });
            if (!existing) {
                this.support.notFound('gpaId', 'GST provider account', gpaId);
            }
            if (existing.gpaIsDeleted) {
                this.support.conflict('GST provider account is already deleted', 'gpaId', 'Nothing to delete.', gst_config_constants_1.GST_CODES.ALREADY_DELETED);
            }
            const updated = await tx.gstProviderAccount.update({
                where: { gpaId },
                data: {
                    gpaIsDeleted: true,
                    gpaModifiedOn: new Date(),
                    gpaModifiedBy: this.support.actor(),
                },
            });
            const code = existing.provider.gpvCode;
            await this.support.audit(tx, {
                action: 'cancel',
                table: TABLE,
                screen: SCREEN,
                pk: gpaId,
                displayName: `${code} ${existing.gpaEnvironment} ${existing.gpaService ?? 'ALL'}`,
                before: (0, gst_config_mappers_1.toAccountPayload)(existing, code),
                after: (0, gst_config_mappers_1.toAccountPayload)(updated, code),
                notes: 'GST provider account soft deleted',
            });
            return { gpaId, deleted: true };
        });
    }
    duplicate(environment, service, clashId) {
        this.support.conflict('Duplicate', 'gpaEnvironment', `The provider already has a live ${environment} account for ${service ?? 'every service'} (${clashId}).`, gst_config_constants_1.GST_CODES.ACCOUNT_DUPLICATE);
    }
};
exports.GstProviderAccountService = GstProviderAccountService;
exports.GstProviderAccountService = GstProviderAccountService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        gst_config_support_1.GstConfigSupport])
], GstProviderAccountService);
//# sourceMappingURL=gst-provider-account.service.js.map