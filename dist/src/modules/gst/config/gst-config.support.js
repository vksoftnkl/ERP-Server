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
exports.GstConfigSupport = void 0;
exports.toDateOnly = toDateOnly;
exports.fromDateOnly = fromDateOnly;
exports.isoOrNull = isoOrNull;
exports.decimalOrNull = decimalOrNull;
exports.keep = keep;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const rights_1 = require("../../../common/posting/rights");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const gst_config_constants_1 = require("./gst-config.constants");
const gst_crypto_service_1 = require("./gst-crypto.service");
const CHECK_FIELDS = {
    ck_gpv_code_shape: 'gpvCode',
    ck_gpv_timeout: 'gpvTimeoutMs',
    ck_gpv_retries: 'gpvMaxRetries',
    ck_gpv_rate_limit: 'gpvRateLimitPerMin',
    ck_gps_service: 'gpsService',
    ck_gps_environment: 'gpsEnvironment',
    ck_gps_auth_scheme: 'gpsAuthScheme',
    ck_gps_payload_encryption: 'gpsPayloadEncryption',
    ck_gps_base_url: 'gpsBaseUrl',
    ck_gps_ttl: 'gpsTokenTtlMinutes',
    ck_gps_margin: 'gpsRefreshMarginMinutes',
    ck_gps_timeout: 'gpsTimeoutMs',
    ck_gps_retries: 'gpsMaxRetries',
    ck_gpa_environment: 'gpaEnvironment',
    ck_gpa_service: 'gpaService',
    ck_gpa_key_ver: 'keyVersion',
    ck_gpa_validity: 'gpaValidUpto',
    ck_gpa_balance: 'gpaCreditBalance',
    ck_gpe_action: 'gpeAction',
    ck_gpe_http_method: 'gpeHttpMethod',
    ck_gpe_path: 'gpePathTemplate',
    ck_gpe_headers: 'gpeHeaders',
    ck_gpe_redact: 'gpeRedactPaths',
    ck_gpe_timeout: 'gpeTimeoutMs',
    ck_gpe_retries: 'gpeMaxRetries',
    ck_gpe_success_pair: 'gpeSuccessValue',
    ck_gfm_direction: 'gfmDirection',
    ck_gfm_data_type: 'gfmDataType',
    ck_gfm_transform: 'gfmTransform',
    ck_gfm_path: 'gfmTheirPath',
    ck_gfm_required_default: 'gfmDefaultValue',
    ck_gem_service: 'gemService',
    ck_gem_our_code: 'gemOurCode',
    ck_gem_severity: 'gemSeverity',
    ck_gem_treat_as: 'gemTreatAs',
    ck_gem_recovery_action: 'gemRecoveryAction',
    ck_gem_extract_pair: 'gemExtractPath',
    ck_gem_extract_path: 'gemExtractPath',
    ck_gem_retry_after: 'gemRetryAfterSeconds',
    ck_gcc_service: 'gccService',
    ck_gcc_environment: 'gccEnvironment',
    ck_gcc_client_pair: 'clientSecret',
    ck_gcc_priority: 'gccPriority',
    ck_gcc_key_ver: 'keyVersion',
    ck_gcc_validity: 'gccValidUpto',
};
let GstConfigSupport = class GstConfigSupport {
    prisma;
    requestContext;
    auditLogService;
    crypto;
    menuIds = new Map();
    constructor(prisma, requestContext, auditLogService, crypto) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.auditLogService = auditLogService;
        this.crypto = crypto;
    }
    async requireRight(menu, right, action) {
        await (0, rights_1.assertMenuRight)(this.prisma, {
            userId: this.requestContext.getUserId(),
            menuId: await this.menuIdOf(menu),
            right,
            codePrefix: 'GST',
            action,
        });
    }
    actor() {
        return this.requestContext.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
    }
    async audit(tx, entry) {
        await this.auditLogService.logEntityChange({
            action: entry.action,
            tableName: entry.table,
            screenName: entry.screen,
            screenType: 'master',
            pk: entry.pk,
            displayName: entry.displayName,
            originalRecord: entry.before,
            modifiedRecord: entry.after,
            userId: this.actor(),
            notes: entry.notes,
        }, tx);
    }
    notFound(field, what, id) {
        (0, module_service_utils_1.throwSettingsNotFound)(`${what} not found`, field, `No ${what.toLowerCase()} found with id ${id}`);
    }
    conflict(message, field, detail, code) {
        (0, module_service_utils_1.throwSettingsConflict)(message, [{ field, message: detail, code }]);
    }
    badRequest(errors) {
        (0, module_service_utils_1.throwSettingsBadRequest)('Validation failed', errors);
    }
    refuseDeleted(field, what, id) {
        this.conflict(`${what} is deleted`, field, `${what} ${id} is deleted. It cannot be edited or used as a parent.`, gst_config_constants_1.GST_CODES.ALREADY_DELETED);
    }
    refuseParentChange(field, stored) {
        this.conflict('The parent cannot change', field, `This row belongs to ${stored}. Create a new row under the other parent instead.`, gst_config_constants_1.GST_CODES.PARENT_FIXED);
    }
    translateWriteError(error, uniques) {
        if ((0, module_service_utils_1.isUniqueConstraintError)(error)) {
            const constraint = (0, module_service_utils_1.violatedConstraintOf)(error) ?? '';
            const hit = uniques.find((u) => u.match.some((m) => constraint.includes(m))) ??
                (uniques.length === 1 ? uniques[0] : undefined);
            if (hit) {
                this.conflict('Duplicate', hit.field, hit.message, hit.code);
            }
            this.conflict('Duplicate', 'id', `Refused by ${constraint || 'a unique index'}.`, 'GST_DUPLICATE');
        }
        const check = (0, module_service_utils_1.violatedCheckOf)(error);
        if (check) {
            this.badRequest([
                { field: CHECK_FIELDS[check] ?? check, message: `refused by ${check}`, code: 'GST_CHECK' },
            ]);
        }
    }
    writeSecrets(params) {
        const clear = new Set(params.clear ?? []);
        const errors = [];
        for (const spec of params.specs) {
            const value = params.input[spec.key];
            if (clear.has(spec.key) && typeof value === 'string' && value !== '') {
                errors.push({
                    field: spec.key,
                    message: `${spec.key} is both given and in clear; send one`,
                });
            }
        }
        if (errors.length) {
            this.badRequest(errors);
        }
        const data = {};
        const written = [];
        for (const spec of params.specs) {
            const value = params.input[spec.key];
            if (typeof value === 'string' && value !== '') {
                data[spec.column] = this.crypto.encrypt(value);
                written.push(spec.key);
            }
            else if (clear.has(spec.key)) {
                data[spec.column] = null;
            }
        }
        const current = this.crypto.currentVersion();
        if (!written.length) {
            return { data, keyVersion: params.storedVersion ?? current, written };
        }
        for (const spec of params.specs) {
            const kept = params.stored?.[spec.column];
            if (spec.column in data || !kept || this.crypto.versionOf(kept) === current) {
                continue;
            }
            data[spec.column] = this.crypto.encrypt(this.crypto.decrypt(kept));
        }
        return { data, keyVersion: current, written };
    }
    async menuIdOf(menu) {
        const cached = this.menuIds.get(menu.name);
        if (cached !== undefined) {
            return cached;
        }
        const row = await this.prisma.menu.findFirst({
            where: { menuParentId: menu.parent, menuName: menu.name },
            select: { menuId: true },
        });
        if (!row) {
            return 0;
        }
        this.menuIds.set(menu.name, row.menuId);
        return row.menuId;
    }
};
exports.GstConfigSupport = GstConfigSupport;
exports.GstConfigSupport = GstConfigSupport = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        audit_log_service_1.AuditLogService,
        gst_crypto_service_1.GstCryptoService])
], GstConfigSupport);
function toDateOnly(value) {
    if (value === undefined || value === null) {
        return value;
    }
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}
function fromDateOnly(value) {
    return value ? value.toISOString().slice(0, 10) : null;
}
function isoOrNull(value) {
    return value ? value.toISOString() : null;
}
function decimalOrNull(value) {
    return (0, module_service_utils_1.toNullableNumber)(value);
}
function keep(sent, stored, fallback) {
    if (sent !== undefined) {
        return sent;
    }
    return stored !== undefined ? stored : fallback;
}
//# sourceMappingURL=gst-config.support.js.map