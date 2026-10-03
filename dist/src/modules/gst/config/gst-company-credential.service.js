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
exports.GstCompanyCredentialService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const gst_config_constants_1 = require("./gst-config.constants");
const gst_config_mappers_1 = require("./gst-config.mappers");
const gst_config_support_1 = require("./gst-config.support");
const gst_auth_lease_1 = require("../client/gst-auth-lease");
const gst_auth_service_1 = require("../client/gst-auth.service");
const TABLE = 'gst company credential';
const SCREEN = 'GST Company Credential';
const SECRETS = [
    { key: 'password', column: 'gccPasswordEnc' },
    { key: 'clientId', column: 'gccClientIdEnc' },
    { key: 'clientSecret', column: 'gccClientSecretEnc' },
    { key: 'appKey', column: 'gccAppKeyEnc' },
];
const CONTEXT_INCLUDE = {
    company: { select: { compName: true, compGstinNo: true } },
    branch: { select: { brName: true, brGstinNo: true } },
    provider: { select: { gpvCode: true, gpvName: true } },
};
let GstCompanyCredentialService = class GstCompanyCredentialService {
    prisma;
    support;
    auth;
    constructor(prisma, support, auth) {
        this.prisma = prisma;
        this.support = support;
        this.auth = auth;
    }
    async getById(gccId) {
        await this.support.requireRight(gst_config_constants_1.GST_CREDENTIALS_MENU, 'view', 'view GST credentials');
        return this.toPayload(await this.loadOrThrow(this.prisma, gccId));
    }
    async save(dto) {
        const creating = dto.gccId === undefined;
        await this.support.requireRight(gst_config_constants_1.GST_CREDENTIALS_MENU, creating ? 'create' : 'edit', creating ? 'create GST credentials' : 'edit GST credentials');
        const actor = this.support.actor();
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = creating ? null : await this.loadOrThrow(tx, dto.gccId);
                if (existing?.gccIsDeleted) {
                    this.support.refuseDeleted('gccId', 'GST credential', existing.gccId);
                }
                if (existing && existing.gccCompanyId !== dto.gccCompanyId) {
                    this.support.refuseParentChange('gccCompanyId', `company ${existing.gccCompanyId}`);
                }
                const key = {
                    gccCompanyId: dto.gccCompanyId,
                    gccBranchId: (0, gst_config_support_1.keep)(dto.gccBranchId, existing?.gccBranchId, null),
                    gccService: (0, gst_config_support_1.keep)(dto.gccService, existing?.gccService, null),
                    gccEnvironment: dto.gccEnvironment,
                };
                await this.assertGstinResolves(tx, key);
                await this.liveProvider(tx, dto.gccGpvId);
                const validFrom = (0, gst_config_support_1.toDateOnly)(dto.gccValidFrom);
                const validUpto = (0, gst_config_support_1.keep)((0, gst_config_support_1.toDateOnly)(dto.gccValidUpto), existing?.gccValidUpto, null);
                const errors = [];
                if (validUpto && validFrom > validUpto) {
                    errors.push({ field: 'gccValidUpto', message: 'must not be before gccValidFrom' });
                }
                if (creating && !dto.password) {
                    errors.push({ field: 'password', message: 'password is required on create' });
                }
                if (errors.length) {
                    this.support.badRequest(errors);
                }
                const priority = (0, gst_config_support_1.keep)(dto.gccPriority, existing?.gccPriority, 1);
                const isActive = (0, gst_config_support_1.keep)(dto.gccIsActive, existing?.gccIsActive, true);
                await this.assertSlotIsFree(tx, key, priority, isActive, existing?.gccId ?? null);
                const secrets = this.support.writeSecrets({
                    specs: SECRETS,
                    input: dto,
                    clear: dto.clear,
                    stored: existing
                        ? {
                            gccPasswordEnc: existing.gccPasswordEnc,
                            gccClientIdEnc: existing.gccClientIdEnc,
                            gccClientSecretEnc: existing.gccClientSecretEnc,
                            gccAppKeyEnc: existing.gccAppKeyEnc,
                        }
                        : null,
                    storedVersion: existing?.gccKeyVersion ?? null,
                });
                const hasClientId = 'gccClientIdEnc' in secrets.data
                    ? secrets.data.gccClientIdEnc !== null
                    : Boolean(existing?.gccClientIdEnc);
                const hasClientSecret = 'gccClientSecretEnc' in secrets.data
                    ? secrets.data.gccClientSecretEnc !== null
                    : Boolean(existing?.gccClientSecretEnc);
                if (hasClientId !== hasClientSecret) {
                    this.support.badRequest([
                        {
                            field: hasClientId ? 'clientSecret' : 'clientId',
                            message: 'clientId and clientSecret are set together, or neither',
                        },
                    ]);
                }
                const publicKeyRef = (0, gst_config_support_1.keep)(dto.gccPublicKeyRef, existing?.gccPublicKeyRef, null);
                const now = new Date();
                const data = {
                    gccBranchId: key.gccBranchId,
                    gccGpvId: dto.gccGpvId,
                    gccService: key.gccService,
                    gccEnvironment: key.gccEnvironment,
                    gccPriority: priority,
                    gccLoginId: dto.gccLoginId,
                    ...secrets.data,
                    gccKeyVersion: secrets.keyVersion,
                    gccPublicKeyRef: publicKeyRef,
                    gccWhitelistedIps: (0, gst_config_support_1.keep)(dto.gccWhitelistedIps, existing?.gccWhitelistedIps, []),
                    gccValidFrom: validFrom,
                    gccValidUpto: validUpto,
                    ...(secrets.written.includes('password') ? { gccPasswordChangedOn: now } : {}),
                    gccRemarks: (0, gst_config_support_1.keep)(dto.gccRemarks, existing?.gccRemarks, null),
                    gccIsActive: isActive,
                };
                const saved = existing
                    ? await tx.gstCompanyCredential.update({
                        where: { gccId: existing.gccId },
                        data: { ...data, gccModifiedOn: now, gccModifiedBy: actor },
                        include: CONTEXT_INCLUDE,
                    })
                    : await tx.gstCompanyCredential.create({
                        data: {
                            ...data,
                            gccCompanyId: key.gccCompanyId,
                            gccPasswordEnc: secrets.data.gccPasswordEnc,
                            gccCreatedBy: actor,
                        },
                        include: CONTEXT_INCLUDE,
                    });
                const identityChanged = existing !== null &&
                    (existing.gccBranchId !== saved.gccBranchId ||
                        existing.gccGpvId !== saved.gccGpvId ||
                        existing.gccService !== saved.gccService ||
                        existing.gccEnvironment !== saved.gccEnvironment ||
                        existing.gccLoginId !== saved.gccLoginId ||
                        existing.gccPublicKeyRef !== saved.gccPublicKeyRef ||
                        Object.keys(secrets.data).length > 0);
                const retired = identityChanged ? await this.retireSessions(tx, saved.gccId) : 0;
                const cleared = (dto.clear ?? []).filter((k) => !secrets.written.includes(k));
                await this.support.audit(tx, {
                    action: existing ? 'update' : 'New',
                    table: TABLE,
                    screen: SCREEN,
                    pk: saved.gccId,
                    displayName: this.displayName(saved),
                    before: existing ? this.toPayload(existing) : null,
                    after: this.toPayload(saved),
                    notes: (existing ? 'GST credential updated' : 'GST credential created') +
                        (secrets.written.length ? `; secrets written: ${secrets.written.join(', ')}` : '') +
                        (cleared.length ? `; secrets cleared: ${cleared.join(', ')}` : '') +
                        (retired ? '; live session retired' : ''),
                });
                return this.toPayload(saved);
            });
        }
        catch (error) {
            this.translateSlotError(error);
            throw error;
        }
    }
    async softDelete(gccId) {
        await this.support.requireRight(gst_config_constants_1.GST_CREDENTIALS_MENU, 'delete', 'delete GST credentials');
        return this.prisma.$transaction(async (tx) => {
            const existing = await this.loadOrThrow(tx, gccId);
            if (existing.gccIsDeleted) {
                this.support.conflict('GST credential is already deleted', 'gccId', 'Nothing to delete. POST /gst/company-credentials/restore brings it back.', gst_config_constants_1.GST_CODES.ALREADY_DELETED);
            }
            const updated = await tx.gstCompanyCredential.update({
                where: { gccId },
                data: {
                    gccIsDeleted: true,
                    gccModifiedOn: new Date(),
                    gccModifiedBy: this.support.actor(),
                },
                include: CONTEXT_INCLUDE,
            });
            await this.retireSessions(tx, gccId);
            await this.support.audit(tx, {
                action: 'cancel',
                table: TABLE,
                screen: SCREEN,
                pk: gccId,
                displayName: this.displayName(existing),
                before: this.toPayload(existing),
                after: this.toPayload(updated),
                notes: 'GST credential soft deleted; live session retired',
            });
            return { gccId, deleted: true };
        });
    }
    async restore(gccId) {
        await this.support.requireRight(gst_config_constants_1.GST_CREDENTIALS_MENU, 'edit', 'restore GST credentials');
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await this.loadOrThrow(tx, gccId);
                if (!existing.gccIsDeleted) {
                    this.support.conflict('GST credential is not deleted', 'gccId', 'Nothing to restore.', gst_config_constants_1.GST_CODES.NOT_DELETED);
                }
                await this.liveProvider(tx, existing.gccGpvId);
                await this.assertSlotIsFree(tx, existing, existing.gccPriority, existing.gccIsActive, gccId);
                const updated = await tx.gstCompanyCredential.update({
                    where: { gccId },
                    data: {
                        gccIsDeleted: false,
                        gccModifiedOn: new Date(),
                        gccModifiedBy: this.support.actor(),
                    },
                    include: CONTEXT_INCLUDE,
                });
                await this.support.audit(tx, {
                    action: 'update',
                    table: TABLE,
                    screen: SCREEN,
                    pk: gccId,
                    displayName: this.displayName(existing),
                    before: this.toPayload(existing),
                    after: this.toPayload(updated),
                    notes: 'GST credential restored',
                });
                return { gccId, deleted: false };
            });
        }
        catch (error) {
            this.translateSlotError(error);
            throw error;
        }
    }
    async verify(gccId) {
        await this.support.requireRight(gst_config_constants_1.GST_CREDENTIALS_MENU, 'post', 'verify GST credentials');
        const outcome = await this.auth.signIn(gccId, this.support.actor());
        return {
            ok: outcome.ok,
            message: outcome.message,
            ...(outcome.errorCode ? { errorCode: outcome.errorCode } : {}),
            ...(outcome.tokenValidUntil ? { tokenValidUntil: outcome.tokenValidUntil } : {}),
            creditBalance: outcome.creditBalance,
        };
    }
    async status(gccId) {
        await this.support.requireRight(gst_config_constants_1.GST_CREDENTIALS_MENU, 'view', 'view GST credentials');
        const credential = await this.loadOrThrow(this.prisma, gccId);
        const [session] = await this.prisma.$queryRaw `
      SELECT gas_auth_token_enc <> '' AND gas_token_type <> 'PENDING' AS has_token,
             gas_expires_on AS expires_on,
             gas_issued_on  AS issued_on,
             (gas_lock_upto IS NULL OR gas_lock_upto < now()) AS lease_free
        FROM public.gst_auth_session
       WHERE gas_gcc_id = ${gccId}::uuid
         AND gas_is_active = true
         AND gas_is_deleted = false
       LIMIT 1`;
        const live = session?.has_token ? session : null;
        const account = await (0, gst_auth_lease_1.resolveProviderAccount)(this.prisma, credential);
        return {
            gccId,
            hasLiveToken: live !== null && live.expires_on > new Date(),
            tokenExpiresOn: (0, gst_config_support_1.isoOrNull)(live?.expires_on ?? null),
            issuedOn: (0, gst_config_support_1.isoOrNull)(live?.issued_on ?? null),
            leaseFree: session ? session.lease_free : true,
            lastVerifiedOn: (0, gst_config_support_1.isoOrNull)(credential.gccLastVerifiedOn),
            lastErrorMessage: credential.gccLastErrorMessage,
            creditBalance: (0, gst_config_support_1.decimalOrNull)(account?.gpaCreditBalance ?? null),
        };
    }
    async loadOrThrow(client, gccId) {
        const row = await client.gstCompanyCredential.findUnique({
            where: { gccId },
            include: CONTEXT_INCLUDE,
        });
        if (!row) {
            this.support.notFound('gccId', 'GST credential', gccId);
        }
        return row;
    }
    async assertGstinResolves(tx, key) {
        const company = await tx.company.findUnique({
            where: { compId: key.gccCompanyId },
            select: { compIsDeleted: true, compGstinNo: true, compName: true },
        });
        if (!company || company.compIsDeleted) {
            this.support.notFound('gccCompanyId', 'Company', key.gccCompanyId);
        }
        let branchGstin = null;
        if (key.gccBranchId) {
            const branch = await tx.branchMaster.findUnique({
                where: { brId: key.gccBranchId },
                select: { brCompId: true, brIsDeleted: true, brGstinNo: true },
            });
            if (!branch || branch.brIsDeleted) {
                this.support.notFound('gccBranchId', 'Branch', key.gccBranchId);
            }
            if (branch.brCompId !== key.gccCompanyId) {
                this.support.badRequest([
                    {
                        field: 'gccBranchId',
                        message: `the branch belongs to company ${branch.brCompId}, not this one`,
                    },
                ]);
            }
            branchGstin = branch.brGstinNo?.trim() || null;
        }
        if (!branchGstin && !company.compGstinNo?.trim()) {
            throwNoGstin(key.gccBranchId ? 'gccBranchId' : 'gccCompanyId', company.compName);
        }
    }
    async liveProvider(tx, gpvId) {
        const provider = await tx.gstProvider.findUnique({
            where: { gpvId },
            select: { gpvIsDeleted: true },
        });
        if (!provider) {
            this.support.notFound('gccGpvId', 'GST provider', gpvId);
        }
        if (provider.gpvIsDeleted) {
            this.support.refuseDeleted('gccGpvId', 'GST provider', gpvId);
        }
    }
    async assertSlotIsFree(tx, key, priority, isActive, excludeId) {
        const clash = await tx.gstCompanyCredential.findFirst({
            where: {
                gccCompanyId: key.gccCompanyId,
                gccBranchId: key.gccBranchId,
                gccService: key.gccService,
                gccEnvironment: key.gccEnvironment,
                gccPriority: priority,
                gccIsDeleted: false,
                ...(excludeId ? { gccId: { not: excludeId } } : {}),
            },
            select: { gccId: true, gccIsActive: true },
        });
        if (!clash) {
            return;
        }
        const scope = `${key.gccService ?? 'every service'} ${key.gccEnvironment}` +
            (key.gccBranchId ? ` for branch ${key.gccBranchId}` : '');
        if (priority === 1 && isActive && clash.gccIsActive) {
            this.support.conflict('A primary credential already exists', 'gccPriority', `Credential ${clash.gccId} is the primary for ${scope}. Give this one priority 2+ (a failover), or deactivate that one first.`, gst_config_constants_1.GST_CODES.CREDENTIAL_PRIMARY_EXISTS);
        }
        this.support.conflict('Priority already taken', 'gccPriority', `Credential ${clash.gccId} already holds priority ${priority} for ${scope}.`, gst_config_constants_1.GST_CODES.CREDENTIAL_PRIORITY_TAKEN);
    }
    translateSlotError(error) {
        this.support.translateWriteError(error, [
            {
                match: ['ux_gcc_order', 'gcc_priority'],
                field: 'gccPriority',
                message: 'Another live credential holds that priority for this company, branch, service and environment.',
                code: gst_config_constants_1.GST_CODES.CREDENTIAL_PRIORITY_TAKEN,
            },
            {
                match: ['ux_gcc_primary', 'gcc_company_id'],
                field: 'gccPriority',
                message: 'Another live, active credential is already the primary for this company, branch, service and environment.',
                code: gst_config_constants_1.GST_CODES.CREDENTIAL_PRIMARY_EXISTS,
            },
        ]);
    }
    async retireSessions(tx, gccId) {
        const { count } = await tx.gstAuthSession.updateMany({
            where: { gasGccId: gccId, gasIsActive: true, gasIsDeleted: false },
            data: { gasIsActive: false, gasLockBy: null, gasLockOn: null, gasLockUpto: null },
        });
        return count;
    }
    displayName(row) {
        return `${row.company.compName} ${row.gccService ?? 'ALL'} ${row.gccEnvironment} #${row.gccPriority}`;
    }
    toPayload(row) {
        const context = {
            compName: row.company.compName,
            compGstinNo: row.company.compGstinNo,
            brName: row.branch?.brName ?? null,
            brGstinNo: row.branch?.brGstinNo ?? null,
            gpvCode: row.provider.gpvCode,
            gpvName: row.provider.gpvName,
        };
        return (0, gst_config_mappers_1.toCredentialPayload)(row, context, (0, gst_config_mappers_1.istToday)());
    }
};
exports.GstCompanyCredentialService = GstCompanyCredentialService;
exports.GstCompanyCredentialService = GstCompanyCredentialService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        gst_config_support_1.GstConfigSupport,
        gst_auth_service_1.GstAuthService])
], GstCompanyCredentialService);
function throwNoGstin(field, compName) {
    (0, module_service_utils_1.throwUnprocessable)('No GSTIN to sign in as', [
        {
            field,
            message: `${compName} has no GSTIN${field === 'gccBranchId' ? ', and neither does the branch' : ''}. Set it in Company Master (or Branch Master) first.`,
            code: gst_config_constants_1.GST_CODES.NO_GSTIN,
        },
    ]);
}
//# sourceMappingURL=gst-company-credential.service.js.map