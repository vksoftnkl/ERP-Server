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
exports.TxnHoldService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const configured_grid_sql_service_1 = require("../../../common/configured-grid-sql/configured-grid-sql.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const txn_hold_api_types_1 = require("./types/txn-hold-api.types");
const module_list_utils_1 = require("../../../common/utils/module-list.utils");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const TXN_HOLD_TABLE_NAME = 'txn hold';
const TXN_HOLD_AUDIT_SCREEN_NAME = 'Transaction Hold';
const TXN_HOLD_GRID_ALIAS = 'txn_hold_grid';
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;
const TXN_HOLD_OPTIONAL_FIELDS = [
    'txhTenantId',
    'txhKind',
    'txhSrcModule',
    'txhDocType',
    'txhHoldOn',
    'txhCounterId',
    'txhSessionId',
    'txhPartyType',
    'txhPartyId',
    'txhPartyName',
    'txhPartyMobile',
    'txhStaffId',
    'txhRefLabel',
    'txhItemCount',
    'txhTotalQty',
    'txhNetAmount',
    'txhPayload',
    'txhPayloadVersion',
    'txhStatus',
    'txhHoldReason',
    'txhRemarks',
    'txhExpiresOn',
    'txhIsStockReserved',
    'txhPrintCount',
    'txhLastPrintedOn',
    'txhSyncDate',
];
const TXN_HOLD_DEFAULTED_FIELDS = [
    'txhKind',
    'txhHoldOn',
    'txhItemCount',
    'txhTotalQty',
    'txhNetAmount',
    'txhPayload',
    'txhPayloadVersion',
    'txhStatus',
    'txhIsStockReserved',
    'txhPrintCount',
];
const TXN_HOLD_TEXT_FIELDS = [
    'txhPartyName',
    'txhPartyMobile',
    'txhRefLabel',
    'txhHoldReason',
    'txhRemarks',
];
function dropNullish(value) {
    return value === null ? undefined : value;
}
const TXN_HOLD_FIELD_TRANSFORMS = {
    ...Object.fromEntries(TXN_HOLD_DEFAULTED_FIELDS.map((field) => [field, dropNullish])),
    ...Object.fromEntries(TXN_HOLD_TEXT_FIELDS.map((field) => [
        field,
        (value) => (0, module_service_utils_1.normalizeNullableString)(value),
    ])),
};
let TxnHoldService = class TxnHoldService {
    prisma;
    auditLogService;
    configuredGridSqlService;
    requestContextService;
    constructor(prisma, auditLogService, configuredGridSqlService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.configuredGridSqlService = configuredGridSqlService;
        this.requestContextService = requestContextService;
    }
    async save(saveTxnHoldDto) {
        if (saveTxnHoldDto.txhId) {
            return this.updateHold(saveTxnHoldDto);
        }
        return this.createHold(saveTxnHoldDto);
    }
    async list(queryDto) {
        const { page, limit, skip } = (0, module_list_utils_1.resolvePagination)(queryDto);
        const where = this.buildListWhere(queryDto);
        return (0, module_list_utils_1.runSalesListQuery)({ page, limit }, {
            hasStructuredFilters: this.hasStructuredFilters(queryDto),
            configuredGridFn: () => (0, module_list_utils_1.runConfiguredGridQuery)(this.configuredGridSqlService, {
                tableName: TXN_HOLD_TABLE_NAME,
                alias: TXN_HOLD_GRID_ALIAS,
                search: queryDto.search,
                page,
                limit,
                skip,
            }),
            countFn: () => this.prisma.txnHold.count({ where }),
            findManyFn: () => this.prisma.txnHold.findMany({
                where,
                orderBy: [{ txhHoldOn: 'desc' }, { txhId: 'desc' }],
                skip,
                take: limit,
            }),
            toItemFn: (record) => this.toPayload(record),
        });
    }
    async getById(txhId, txhAccYear) {
        const record = await this.prisma.txnHold.findFirst({
            where: { txhId, txhIsDeleted: false, ...(txhAccYear ? { txhAccYear } : {}) },
        });
        if (!record) {
            this.throwNotFound(txhId);
        }
        return this.toPayload(record);
    }
    async softDelete(txhId, txhAccYear) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.txnHold.findFirst({
                where: { txhId, txhIsDeleted: false, ...(txhAccYear ? { txhAccYear } : {}) },
            });
            if (!existing) {
                this.throwNotFound(txhId);
            }
            const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
            const deleted = await tx.txnHold.update({
                where: this.pk(existing),
                data: {
                    txhIsDeleted: true,
                    txhModifiedOn: new Date(),
                    txhModifiedBy: actor,
                },
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: TXN_HOLD_TABLE_NAME,
                screenName: TXN_HOLD_AUDIT_SCREEN_NAME,
                screenType: 'transaction',
                pk: txhId,
                displayName: this.displayName(existing),
                originalRecord: this.toPayload(existing),
                modifiedRecord: this.toPayload(deleted),
                userId: actor,
                branchId: existing.txhBranchId,
                notes: 'Hold soft deleted',
            }, tx);
            return { txhId, deleted: true };
        });
    }
    async resumeHold(txhId, deviceId, scope) {
        const device = this.requireDeviceId(deviceId);
        const operator = this.requireOperator();
        return this.prisma.$transaction(async (tx) => {
            const now = new Date();
            const before = await this.readLocked(tx, txhId, scope);
            this.ensureKindIsLeasable(before);
            const expiresOn = this.leaseExpiry(now, scope.lockTtlSeconds);
            const token = (0, node_crypto_1.randomUUID)();
            const acquired = await tx.txnHold.updateMany({
                where: {
                    ...this.lockWhere(txhId, scope),
                    OR: [
                        { txhStatus: txn_hold_api_types_1.TxnHoldStatus.HELD },
                        { txhStatus: txn_hold_api_types_1.TxnHoldStatus.LOCKED, txhLockExpiresOn: { lt: now } },
                    ],
                },
                data: {
                    txhStatus: txn_hold_api_types_1.TxnHoldStatus.LOCKED,
                    txhLockedBy: operator,
                    txhLockedDeviceId: device,
                    txhLockedOn: now,
                    txhLockExpiresOn: expiresOn,
                    txhLockToken: token,
                    txhResumedBy: operator,
                    txhResumedOn: now,
                    txhResumeCount: { increment: 1 },
                    txhModifiedOn: now,
                    txhModifiedBy: operator,
                },
            });
            if (acquired.count === 0) {
                return this.resolveResumeFailure(tx, txhId, device, scope);
            }
            const resumed = await this.readLocked(tx, txhId, scope);
            await this.auditLockTransition(tx, {
                original: before,
                modified: resumed,
                userId: operator,
                notes: `Hold resumed on device ${device}, lease until ${expiresOn.toISOString()}` +
                    (before.txhStatus === String(txn_hold_api_types_1.TxnHoldStatus.LOCKED)
                        ? `, taken over from a lapsed lease on device ${before.txhLockedDeviceId ?? 'unknown'}`
                        : ''),
            });
            return this.toPayload(resumed);
        });
    }
    async releaseHold(txhId, deviceId, scope) {
        const device = this.requireDeviceId(deviceId);
        const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        return this.prisma.$transaction(async (tx) => {
            const now = new Date();
            const before = await tx.txnHold.findFirst({ where: this.lockWhere(txhId, scope) });
            const released = await tx.txnHold.updateMany({
                where: {
                    ...this.lockWhere(txhId, scope),
                    txhStatus: txn_hold_api_types_1.TxnHoldStatus.LOCKED,
                    txhLockedDeviceId: device,
                    ...(scope.txhLockToken ? { txhLockToken: scope.txhLockToken } : {}),
                },
                data: {
                    txhStatus: txn_hold_api_types_1.TxnHoldStatus.HELD,
                    ...this.emptyLease(),
                    txhModifiedOn: now,
                    txhModifiedBy: actor,
                },
            });
            if (released.count === 0) {
                return this.resolveReleaseFailure(tx, txhId, scope);
            }
            const free = await this.readLocked(tx, txhId, scope);
            await this.auditLockTransition(tx, {
                original: before,
                modified: free,
                userId: actor,
                notes: `Hold released by device ${device}`,
            });
            return this.toPayload(free);
        });
    }
    async forceReleaseHold(txhId, deviceId, scope) {
        const device = this.requireDeviceId(deviceId);
        const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        return this.prisma.$transaction(async (tx) => {
            const now = new Date();
            const before = await tx.txnHold.findFirst({ where: this.lockWhere(txhId, scope) });
            const taken = await tx.txnHold.updateMany({
                where: {
                    ...this.lockWhere(txhId, scope),
                    txhStatus: { in: [...txn_hold_api_types_1.TXN_HOLD_IN_USE_STATUSES] },
                },
                data: {
                    txhStatus: txn_hold_api_types_1.TxnHoldStatus.HELD,
                    ...this.emptyLease(),
                    txhModifiedOn: now,
                    txhModifiedBy: actor,
                },
            });
            if (taken.count === 0) {
                return this.resolveReleaseFailure(tx, txhId, scope);
            }
            const free = await this.readLocked(tx, txhId, scope);
            await this.auditLockTransition(tx, {
                original: before,
                modified: free,
                userId: actor,
                notes: `Hold lease force released by device ${device}` +
                    (before?.txhLockedDeviceId ? `, taken from device ${before.txhLockedDeviceId}` : ''),
            });
            return this.toPayload(free);
        });
    }
    async convertHold(txhId, deviceId, scope, conversion) {
        const device = this.requireDeviceId(deviceId);
        const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        this.ensureConversionIsAllowed(conversion);
        return this.prisma.$transaction(async (tx) => {
            const now = new Date();
            const before = await tx.txnHold.findFirst({ where: this.lockWhere(txhId, scope) });
            const converted = await tx.txnHold.updateMany({
                where: {
                    ...this.lockWhere(txhId, scope),
                    txhStatus: txn_hold_api_types_1.TxnHoldStatus.LOCKED,
                    txhLockedDeviceId: device,
                    ...(scope.txhLockToken ? { txhLockToken: scope.txhLockToken } : {}),
                },
                data: {
                    txhStatus: txn_hold_api_types_1.TxnHoldStatus.CONVERTED,
                    txhConvertedDocId: conversion.txhConvertedDocId,
                    txhConvertedAccYear: conversion.txhConvertedAccYear,
                    txhConvertedRefno: (0, module_service_utils_1.normalizeNullableString)(conversion.txhConvertedRefno) ?? null,
                    txhConvertedOn: now,
                    txhConvertedBy: (0, module_service_utils_1.resolveActor)(conversion.txhConvertedBy, actor),
                    ...this.emptyLease(),
                    txhModifiedOn: now,
                    txhModifiedBy: actor,
                },
            });
            if (converted.count === 0) {
                return this.resolveConvertFailure(tx, txhId, scope);
            }
            const closed = await this.readLocked(tx, txhId, scope);
            await this.auditLockTransition(tx, {
                original: before,
                modified: closed,
                userId: actor,
                notes: `Hold converted to ${closed.txhDocType} ${conversion.txhConvertedDocId} ` +
                    `(${conversion.txhConvertedAccYear}) on device ${device}`,
            });
            return this.toPayload(closed);
        });
    }
    async resolveResumeFailure(tx, txhId, device, scope) {
        const current = await this.readLocked(tx, txhId, scope);
        if (current.txhStatus === String(txn_hold_api_types_1.TxnHoldStatus.LOCKED) &&
            current.txhLockedDeviceId === device) {
            return this.toPayload(current);
        }
        if (current.txhStatus === String(txn_hold_api_types_1.TxnHoldStatus.LOCKED)) {
            (0, module_service_utils_1.throwSalesConflict)(`Hold is LOCKED by device ${current.txhLockedDeviceId ?? 'unknown'}`, [
                {
                    field: 'txhLockedDeviceId',
                    message: `The hold is in use on device ${current.txhLockedDeviceId ?? 'unknown'} until ` +
                        `${current.txhLockExpiresOn?.toISOString() ?? 'the lease is released'}. It has to ` +
                        'be released there, expire, or be force-released before another device can ' +
                        'resume it',
                },
            ]);
        }
        (0, module_service_utils_1.throwSalesConflict)(`Hold is ${current.txhStatus} and cannot be resumed`, [
            {
                field: 'txhStatus',
                message: `Only a hold in status ${txn_hold_api_types_1.TxnHoldStatus.HELD} can be resumed`,
            },
        ]);
    }
    async resolveReleaseFailure(tx, txhId, scope) {
        const current = await this.readLocked(tx, txhId, scope);
        if (current.txhStatus === String(txn_hold_api_types_1.TxnHoldStatus.HELD)) {
            return this.toPayload(current);
        }
        this.throwLockOwnershipFailure(current, 'released');
    }
    async resolveConvertFailure(tx, txhId, scope) {
        const current = await this.readLocked(tx, txhId, scope);
        this.throwLockOwnershipFailure(current, 'converted');
    }
    throwLockOwnershipFailure(current, action) {
        if (txn_hold_api_types_1.TXN_HOLD_CLOSED_STATUSES.includes(current.txhStatus)) {
            (0, module_service_utils_1.throwSalesConflict)('Hold is already closed', [
                {
                    field: 'txhStatus',
                    message: `A hold in status ${current.txhStatus} cannot be ${action}`,
                },
            ]);
        }
        (0, module_service_utils_1.throwSalesForbidden)('Not leased by this device', [
            {
                field: 'txhLockedDeviceId',
                message: current.txhLockedDeviceId
                    ? `The hold is leased by device ${current.txhLockedDeviceId}, so only that device can ` +
                        `have it ${action}`
                    : `The hold is ${current.txhStatus} and has to be resumed on this device before it ` +
                        `can be ${action}`,
            },
        ]);
    }
    lockWhere(txhId, scope) {
        return {
            txhId,
            txhCompanyId: scope.txhCompanyId,
            txhBranchId: scope.txhBranchId,
            txhIsDeleted: false,
            ...(scope.txhAccYear ? { txhAccYear: scope.txhAccYear } : {}),
        };
    }
    async readLocked(tx, txhId, scope) {
        const record = await tx.txnHold.findFirst({ where: this.lockWhere(txhId, scope) });
        if (!record) {
            this.throwNotFound(txhId);
        }
        return record;
    }
    pk(record) {
        return { txhId_txhAccYear: { txhId: record.txhId, txhAccYear: record.txhAccYear } };
    }
    emptyLease() {
        return {
            txhLockedBy: null,
            txhLockedDeviceId: null,
            txhLockedOn: null,
            txhLockExpiresOn: null,
            txhLockToken: null,
        };
    }
    leaseExpiry(now, lockTtlSeconds) {
        const ttl = lockTtlSeconds ?? txn_hold_api_types_1.TXN_HOLD_LOCK_TTL_SECONDS_DEFAULT;
        return new Date(now.getTime() + ttl * 1000);
    }
    ensureKindIsLeasable(record) {
        if (record.txhKind === String(txn_hold_api_types_1.TxnHoldKind.TEMPLATE)) {
            (0, module_service_utils_1.throwSalesBadRequest)('Templates cannot be leased', [
                {
                    field: 'txhKind',
                    message: 'A TEMPLATE is copied on resume, not locked. Read it and create a new hold from its ' +
                        'payload instead',
                },
            ]);
        }
    }
    requireDeviceId(deviceId) {
        const trimmed = deviceId?.trim();
        if (!trimmed) {
            (0, module_service_utils_1.throwSalesBadRequest)('Device id is required', [
                {
                    field: 'txhDeviceId',
                    message: 'The X-Device-Id header must be sent to resume, release or convert a hold',
                },
            ]);
        }
        if (!this.isUuid(trimmed)) {
            (0, module_service_utils_1.throwSalesBadRequest)('Device id is not a uuid', [
                {
                    field: 'txhDeviceId',
                    message: 'The X-Device-Id header must be a fixed.device_master uuid (dev_id)',
                },
            ]);
        }
        return trimmed;
    }
    requireOperator() {
        const userId = this.requestContextService.getUserId();
        if (!userId || !this.isUuid(userId)) {
            (0, module_service_utils_1.throwSalesBadRequest)('Operator is required', [
                {
                    field: 'txhLockedBy',
                    message: 'A hold can only be leased by an authenticated user',
                },
            ]);
        }
        return userId;
    }
    isUuid(value) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    }
    ensureConversionIsAllowed(conversion) {
        const details = [];
        if (!conversion.txhConvertedDocId) {
            details.push({
                field: 'txhConvertedDocId',
                message: 'txhConvertedDocId is required when converting a hold',
            });
        }
        if (!ACC_YEAR_PATTERN.test(conversion.txhConvertedAccYear ?? '')) {
            details.push({
                field: 'txhConvertedAccYear',
                message: 'txhConvertedAccYear is required when converting a hold, as YYYY-YYYY',
            });
        }
        if (details.length > 0) {
            (0, module_service_utils_1.throwSalesBadRequest)('Invalid conversion', details);
        }
    }
    async auditLockTransition(tx, entry) {
        await this.auditLogService.logEntityChange({
            action: 'update',
            tableName: TXN_HOLD_TABLE_NAME,
            screenName: TXN_HOLD_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: entry.modified.txhId,
            displayName: this.displayName(entry.modified),
            originalRecord: this.toPayload(entry.original ?? entry.modified),
            modifiedRecord: this.toPayload(entry.modified),
            userId: entry.userId,
            branchId: entry.modified.txhBranchId,
            notes: entry.notes,
        }, tx);
    }
    async createHold(saveTxnHoldDto) {
        const now = new Date();
        const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        const scope = {
            txhCompanyId: this.requireField(saveTxnHoldDto.txhCompanyId, 'txhCompanyId'),
            txhBranchId: this.requireField(saveTxnHoldDto.txhBranchId, 'txhBranchId'),
            txhAccYear: this.requireAccYear(saveTxnHoldDto.txhAccYear, 'txhAccYear'),
        };
        const txhSrcModule = this.requireField(saveTxnHoldDto.txhSrcModule, 'txhSrcModule');
        const txhDocType = this.requireField(saveTxnHoldDto.txhDocType, 'txhDocType');
        const txhHoldNo = saveTxnHoldDto.txhHoldNo ?? null;
        const txhHoldSlno = saveTxnHoldDto.txhHoldSlno ?? null;
        const txhDeviceId = this.requireField(saveTxnHoldDto.txhDeviceId, 'txhDeviceId');
        const txhHeldBy = this.requireField(saveTxnHoldDto.txhHeldBy, 'txhHeldBy');
        const txhPayload = this.requirePayload(saveTxnHoldDto.txhPayload);
        const txhKind = saveTxnHoldDto.txhKind ?? txn_hold_api_types_1.TxnHoldKind.HOLD;
        try {
            return await this.prisma.$transaction(async (tx) => {
                await this.ensureCompanyExists(tx, scope.txhCompanyId);
                await this.ensureBranchExists(tx, scope.txhBranchId);
                await this.ensureDeviceExists(tx, txhDeviceId);
                await this.ensureUserExists(tx, txhHeldBy, 'txhHeldBy');
                await this.ensureSessionExists(tx, saveTxnHoldDto.txhSessionId);
                await this.ensureStaffExists(tx, saveTxnHoldDto.txhStaffId);
                if (txhKind === txn_hold_api_types_1.TxnHoldKind.AUTOSAVE) {
                    const live = await this.findLiveAutosave(tx, {
                        txhAccYear: scope.txhAccYear,
                        txhDeviceId,
                        txhHeldBy,
                        txhDocType,
                    });
                    if (live) {
                        return this.overwriteAutosave(tx, live, saveTxnHoldDto, now, actor);
                    }
                }
                await this.ensureHoldNoIsUnique(tx, txhHoldNo, { ...scope, txhDocType });
                await this.ensureHoldSlnoIsUnique(tx, txhHoldSlno, { ...scope, txhDocType, txhDeviceId });
                const data = {
                    txhCompanyId: scope.txhCompanyId,
                    txhBranchId: scope.txhBranchId,
                    txhAccYear: scope.txhAccYear,
                    txhSrcModule,
                    txhDocType,
                    txhHoldNo,
                    txhHoldSlno,
                    txhDeviceId,
                    txhHeldBy,
                    txhPayload,
                    txhCreatedOn: now,
                    txhCreatedBy: (0, module_service_utils_1.resolveActor)(saveTxnHoldDto.txhCreatedBy, actor),
                };
                (0, module_service_utils_1.applyPresentFields)(data, saveTxnHoldDto, TXN_HOLD_OPTIONAL_FIELDS, TXN_HOLD_FIELD_TRANSFORMS);
                data.txhHoldOn = saveTxnHoldDto.txhHoldOn ?? now;
                this.ensureValuesAreAllowed(undefined, data);
                const created = await tx.txnHold.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: TXN_HOLD_TABLE_NAME,
                    screenName: TXN_HOLD_AUDIT_SCREEN_NAME,
                    screenType: 'transaction',
                    pk: payload.txhId,
                    displayName: this.displayName(created),
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: created.txhCreatedBy,
                    branchId: created.txhBranchId,
                    notes: `${created.txhKind} created`,
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateHold(saveTxnHoldDto) {
        const txhId = saveTxnHoldDto.txhId;
        const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.txnHold.findFirst({
                    where: {
                        txhId,
                        txhIsDeleted: false,
                        ...(saveTxnHoldDto.txhAccYear ? { txhAccYear: saveTxnHoldDto.txhAccYear } : {}),
                    },
                });
                if (!existing) {
                    this.throwNotFound(txhId);
                }
                this.ensureScopeIsUnchanged(saveTxnHoldDto, existing);
                await this.ensureUserExists(tx, saveTxnHoldDto.txhHeldBy, 'txhHeldBy');
                await this.ensureSessionExists(tx, saveTxnHoldDto.txhSessionId);
                await this.ensureStaffExists(tx, saveTxnHoldDto.txhStaffId);
                if (saveTxnHoldDto.txhDeviceId !== undefined) {
                    await this.ensureDeviceExists(tx, saveTxnHoldDto.txhDeviceId);
                }
                const data = {
                    txhModifiedOn: new Date(),
                    txhModifiedBy: (0, module_service_utils_1.resolveActor)(saveTxnHoldDto.txhModifiedBy, actor),
                };
                (0, module_service_utils_1.applyPresentFields)(data, saveTxnHoldDto, TXN_HOLD_OPTIONAL_FIELDS, TXN_HOLD_FIELD_TRANSFORMS);
                const nextDocType = saveTxnHoldDto.txhDocType ?? existing.txhDocType;
                const nextHoldNo = saveTxnHoldDto.txhHoldNo === undefined ? existing.txhHoldNo : saveTxnHoldDto.txhHoldNo;
                const nextSlno = saveTxnHoldDto.txhHoldSlno === undefined
                    ? existing.txhHoldSlno
                    : saveTxnHoldDto.txhHoldSlno;
                const nextDeviceId = saveTxnHoldDto.txhDeviceId ?? existing.txhDeviceId;
                const holdNoScope = {
                    txhCompanyId: existing.txhCompanyId,
                    txhBranchId: existing.txhBranchId,
                    txhAccYear: existing.txhAccYear,
                    txhDocType: nextDocType,
                };
                if (nextHoldNo !== existing.txhHoldNo || nextDocType !== existing.txhDocType) {
                    await this.ensureHoldNoIsUnique(tx, nextHoldNo, holdNoScope, txhId);
                }
                if (nextSlno !== existing.txhHoldSlno ||
                    nextDocType !== existing.txhDocType ||
                    nextDeviceId !== existing.txhDeviceId) {
                    await this.ensureHoldSlnoIsUnique(tx, nextSlno, { ...holdNoScope, txhDeviceId: nextDeviceId }, txhId);
                }
                if (saveTxnHoldDto.txhHoldNo !== undefined) {
                    data.txhHoldNo = saveTxnHoldDto.txhHoldNo;
                }
                if (saveTxnHoldDto.txhHoldSlno !== undefined) {
                    data.txhHoldSlno = saveTxnHoldDto.txhHoldSlno;
                }
                if (saveTxnHoldDto.txhDeviceId !== undefined) {
                    data.txhDeviceId = saveTxnHoldDto.txhDeviceId;
                }
                if (saveTxnHoldDto.txhHeldBy !== undefined) {
                    data.txhHeldBy = saveTxnHoldDto.txhHeldBy;
                }
                data.txhRevision = { increment: 1 };
                this.ensureValuesAreAllowed(existing, data);
                const updated = await tx.txnHold.update({ where: this.pk(existing), data });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: TXN_HOLD_TABLE_NAME,
                    screenName: TXN_HOLD_AUDIT_SCREEN_NAME,
                    screenType: 'transaction',
                    pk: txhId,
                    displayName: this.displayName(updated),
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: (0, module_service_utils_1.resolveActor)(saveTxnHoldDto.txhModifiedBy, actor),
                    branchId: updated.txhBranchId,
                    notes: 'Hold updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async findLiveAutosave(tx, scope) {
        return tx.txnHold.findFirst({
            where: {
                txhKind: txn_hold_api_types_1.TxnHoldKind.AUTOSAVE,
                txhStatus: txn_hold_api_types_1.TxnHoldStatus.HELD,
                txhIsDeleted: false,
                txhAccYear: scope.txhAccYear,
                txhDeviceId: scope.txhDeviceId,
                txhHeldBy: scope.txhHeldBy,
                txhDocType: scope.txhDocType,
            },
        });
    }
    async overwriteAutosave(tx, live, saveTxnHoldDto, now, actor) {
        const data = {
            txhRevision: { increment: 1 },
            txhHoldOn: saveTxnHoldDto.txhHoldOn ?? now,
            txhModifiedOn: now,
            txhModifiedBy: (0, module_service_utils_1.resolveActor)(saveTxnHoldDto.txhModifiedBy, actor),
        };
        (0, module_service_utils_1.applyPresentFields)(data, saveTxnHoldDto, TXN_HOLD_OPTIONAL_FIELDS, TXN_HOLD_FIELD_TRANSFORMS);
        delete data.txhKind;
        delete data.txhStatus;
        this.ensureValuesAreAllowed(live, data);
        const updated = await tx.txnHold.update({ where: this.pk(live), data });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange({
            action: 'update',
            tableName: TXN_HOLD_TABLE_NAME,
            screenName: TXN_HOLD_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: updated.txhId,
            displayName: this.displayName(updated),
            originalRecord: this.toPayload(live),
            modifiedRecord: payload,
            userId: (0, module_service_utils_1.resolveActor)(saveTxnHoldDto.txhModifiedBy, actor),
            branchId: updated.txhBranchId,
            notes: `Autosave overwritten, revision ${updated.txhRevision}`,
        }, tx);
        return payload;
    }
    ensureScopeIsUnchanged(saveTxnHoldDto, existing) {
        const details = [];
        if (saveTxnHoldDto.txhCompanyId && saveTxnHoldDto.txhCompanyId !== existing.txhCompanyId) {
            details.push({
                field: 'txhCompanyId',
                message: `txhCompanyId cannot be changed (stored value is ${existing.txhCompanyId})`,
            });
        }
        if (saveTxnHoldDto.txhBranchId && saveTxnHoldDto.txhBranchId !== existing.txhBranchId) {
            details.push({
                field: 'txhBranchId',
                message: `txhBranchId cannot be changed (stored value is ${existing.txhBranchId})`,
            });
        }
        if (saveTxnHoldDto.txhAccYear && saveTxnHoldDto.txhAccYear !== existing.txhAccYear.trim()) {
            details.push({
                field: 'txhAccYear',
                message: `txhAccYear cannot be changed (stored value is ${existing.txhAccYear.trim()})`,
            });
        }
        if (details.length > 0) {
            (0, module_service_utils_1.throwSalesBadRequest)('Hold scope is immutable', details);
        }
    }
    async ensureHoldNoIsUnique(tx, txhHoldNo, scope, excludeTxhId) {
        if (txhHoldNo === null || txhHoldNo === undefined) {
            return;
        }
        const existing = await tx.txnHold.findFirst({
            where: {
                txhIsDeleted: false,
                txhCompanyId: scope.txhCompanyId,
                txhBranchId: scope.txhBranchId,
                txhAccYear: scope.txhAccYear,
                txhDocType: scope.txhDocType,
                txhHoldNo,
                ...(excludeTxhId ? { txhId: { not: excludeTxhId } } : {}),
            },
            select: { txhId: true },
        });
        if (existing) {
            (0, module_service_utils_1.throwSalesConflict)('Hold number already exists', [
                {
                    field: 'txhHoldNo',
                    message: `A ${scope.txhDocType} hold numbered ${txhHoldNo} already exists for this ` +
                        'company / branch / year',
                },
            ]);
        }
    }
    async ensureHoldSlnoIsUnique(tx, txhHoldSlno, scope, excludeTxhId) {
        if (txhHoldSlno === null || txhHoldSlno === undefined) {
            return;
        }
        const existing = await tx.txnHold.findFirst({
            where: {
                txhIsDeleted: false,
                txhCompanyId: scope.txhCompanyId,
                txhBranchId: scope.txhBranchId,
                txhAccYear: scope.txhAccYear,
                txhDeviceId: scope.txhDeviceId,
                txhDocType: scope.txhDocType,
                txhHoldSlno,
                ...(excludeTxhId ? { txhId: { not: excludeTxhId } } : {}),
            },
            select: { txhId: true },
        });
        if (existing) {
            (0, module_service_utils_1.throwSalesConflict)('Hold serial already exists', [
                {
                    field: 'txhHoldSlno',
                    message: `Device ${scope.txhDeviceId} has already used serial ${txhHoldSlno} for a ` +
                        `${scope.txhDocType} hold this year`,
                },
            ]);
        }
    }
    async ensureCompanyExists(tx, companyId) {
        const company = await tx.company.findFirst({
            where: { compId: companyId, compIsDeleted: false },
            select: { compId: true },
        });
        if (!company) {
            (0, module_service_utils_1.throwSalesBadRequest)('Company does not exist', [
                { field: 'txhCompanyId', message: `No active company found with id ${companyId}` },
            ]);
        }
    }
    async ensureBranchExists(tx, branchId) {
        const branch = await tx.branchMaster.findFirst({
            where: { brId: branchId, brIsDeleted: false },
            select: { brId: true },
        });
        if (!branch) {
            (0, module_service_utils_1.throwSalesBadRequest)('Branch does not exist', [
                { field: 'txhBranchId', message: `No active branch found with id ${branchId}` },
            ]);
        }
    }
    async ensureDeviceExists(tx, deviceId) {
        const device = await tx.deviceMaster.findFirst({
            where: { devId: deviceId, devIsDeleted: false },
            select: { devId: true, devIsBlocked: true },
        });
        if (!device) {
            (0, module_service_utils_1.throwSalesBadRequest)('Device does not exist', [
                { field: 'txhDeviceId', message: `No active device found with id ${deviceId}` },
            ]);
        }
        if (device.devIsBlocked) {
            (0, module_service_utils_1.throwSalesForbidden)('Device is blocked', [
                { field: 'txhDeviceId', message: `Device ${deviceId} is blocked and cannot park work` },
            ]);
        }
    }
    async ensureUserExists(tx, userId, field) {
        if (!userId) {
            return;
        }
        const user = await tx.userMaster.findFirst({
            where: { usrId: userId, usrIsDeleted: false },
            select: { usrId: true },
        });
        if (!user) {
            (0, module_service_utils_1.throwSalesBadRequest)('User does not exist', [
                { field, message: `No active user found with id ${userId}` },
            ]);
        }
    }
    async ensureSessionExists(tx, sessionId) {
        if (!sessionId) {
            return;
        }
        const session = await tx.userLoginSession.findFirst({
            where: { ulsId: sessionId, ulsIsDeleted: false },
            select: { ulsId: true },
        });
        if (!session) {
            (0, module_service_utils_1.throwSalesBadRequest)('Login session does not exist', [
                { field: 'txhSessionId', message: `No active login session found with id ${sessionId}` },
            ]);
        }
    }
    async ensureStaffExists(tx, staffId) {
        if (!staffId) {
            return;
        }
        const staff = await tx.employeeMaster.findFirst({
            where: { empId: staffId, empIsDeleted: false },
            select: { empId: true },
        });
        if (!staff) {
            (0, module_service_utils_1.throwSalesBadRequest)('Employee does not exist', [
                { field: 'txhStaffId', message: `No active employee found with id ${staffId}` },
            ]);
        }
    }
    ensureValuesAreAllowed(existing, data) {
        const details = [];
        const values = {
            txhKind: data.txhKind ?? existing?.txhKind,
            txhSrcModule: data.txhSrcModule ?? existing?.txhSrcModule,
            txhDocType: data.txhDocType ?? existing?.txhDocType,
            txhStatus: data.txhStatus ?? existing?.txhStatus,
            txhPartyType: data.txhPartyType ?? existing?.txhPartyType ?? undefined,
        };
        for (const guard of txn_hold_api_types_1.TXN_HOLD_VALUE_GUARDS) {
            const value = values[guard.field];
            if (value === undefined) {
                continue;
            }
            if (value === null) {
                if (!guard.nullable) {
                    details.push({ field: guard.field, message: `${guard.field} is required` });
                }
                continue;
            }
            if (!guard.allowed.includes(value)) {
                details.push({
                    field: guard.field,
                    message: `${guard.field} must be one of: ${guard.allowed.join(', ')}`,
                });
            }
        }
        const payload = (data.txhPayload ?? existing?.txhPayload);
        if (payload === undefined ||
            payload === null ||
            typeof payload !== 'object' ||
            Array.isArray(payload)) {
            details.push({
                field: 'txhPayload',
                message: 'txhPayload is required and must be a JSON object',
            });
        }
        const partyId = data.txhPartyId ?? existing?.txhPartyId ?? null;
        if (partyId && !values.txhPartyType) {
            details.push({
                field: 'txhPartyType',
                message: 'txhPartyType is required when txhPartyId is set',
            });
        }
        for (const [field, sent, stored] of [
            ['txhItemCount', data.txhItemCount, existing?.txhItemCount],
            ['txhTotalQty', data.txhTotalQty, existing?.txhTotalQty],
            ['txhNetAmount', data.txhNetAmount, existing?.txhNetAmount],
            ['txhPrintCount', data.txhPrintCount, existing?.txhPrintCount],
        ]) {
            const merged = this.mergedNumber(sent, stored);
            if (merged !== null && merged < 0) {
                details.push({ field, message: `${field} must be greater than or equal to 0` });
            }
        }
        const holdOn = data.txhHoldOn ?? existing?.txhHoldOn ?? null;
        const expiresOn = data.txhExpiresOn ?? existing?.txhExpiresOn ?? null;
        if (holdOn && expiresOn && expiresOn.getTime() <= holdOn.getTime()) {
            details.push({
                field: 'txhExpiresOn',
                message: 'txhExpiresOn must be after txhHoldOn',
            });
        }
        const printCount = this.mergedNumber(data.txhPrintCount, existing?.txhPrintCount) ??
            (existing ? existing.txhPrintCount : 0);
        const lastPrintedOn = data.txhLastPrintedOn ?? existing?.txhLastPrintedOn ?? null;
        if ((printCount === 0) !== (lastPrintedOn === null)) {
            details.push({
                field: 'txhLastPrintedOn',
                message: 'txhLastPrintedOn must be set exactly when txhPrintCount is greater than 0 ' +
                    '(and null when it is 0)',
            });
        }
        const status = values.txhStatus ?? txn_hold_api_types_1.TxnHoldStatus.HELD;
        if (data.txhStatus !== undefined) {
            if (status === String(txn_hold_api_types_1.TxnHoldStatus.LOCKED)) {
                details.push({
                    field: 'txhStatus',
                    message: 'A hold is put into LOCKED by POST /txn-holds/:id/resume, not by this payload',
                });
            }
            if (status === String(txn_hold_api_types_1.TxnHoldStatus.CONVERTED)) {
                details.push({
                    field: 'txhStatus',
                    message: 'A hold is put into CONVERTED by POST /txn-holds/:id/convert, which stamps the ' +
                        'conversion trail with it',
                });
            }
        }
        if (details.length > 0) {
            (0, module_service_utils_1.throwSalesBadRequest)('Invalid hold value', details);
        }
        if (existing &&
            txn_hold_api_types_1.TXN_HOLD_CLOSED_STATUSES.includes(existing.txhStatus) &&
            status !== existing.txhStatus) {
            (0, module_service_utils_1.throwSalesConflict)('Hold is already closed', [
                {
                    field: 'txhStatus',
                    message: `A hold in status ${existing.txhStatus} cannot be reopened`,
                },
            ]);
        }
    }
    buildListWhere(queryDto) {
        const filters = [];
        const search = queryDto.search?.trim();
        if (search) {
            filters.push({
                OR: [
                    { txhHoldNo: { contains: search, mode: 'insensitive' } },
                    { txhPartyName: { contains: search, mode: 'insensitive' } },
                    { txhPartyMobile: { contains: search, mode: 'insensitive' } },
                    { txhRefLabel: { contains: search, mode: 'insensitive' } },
                    { txhRemarks: { contains: search, mode: 'insensitive' } },
                ],
            });
        }
        if (queryDto.txhCompanyId)
            filters.push({ txhCompanyId: queryDto.txhCompanyId });
        if (queryDto.txhBranchId)
            filters.push({ txhBranchId: queryDto.txhBranchId });
        if (queryDto.txhAccYear)
            filters.push({ txhAccYear: queryDto.txhAccYear });
        if (queryDto.txhKind)
            filters.push({ txhKind: queryDto.txhKind });
        if (queryDto.txhSrcModule)
            filters.push({ txhSrcModule: queryDto.txhSrcModule });
        if (queryDto.txhDocType)
            filters.push({ txhDocType: queryDto.txhDocType });
        if (queryDto.txhStatus)
            filters.push({ txhStatus: queryDto.txhStatus });
        if (queryDto.txhDeviceId)
            filters.push({ txhDeviceId: queryDto.txhDeviceId });
        if (queryDto.txhCounterId)
            filters.push({ txhCounterId: queryDto.txhCounterId });
        if (queryDto.txhSessionId)
            filters.push({ txhSessionId: queryDto.txhSessionId });
        if (queryDto.txhHeldBy)
            filters.push({ txhHeldBy: queryDto.txhHeldBy });
        if (queryDto.txhPartyType)
            filters.push({ txhPartyType: queryDto.txhPartyType });
        if (queryDto.txhPartyId)
            filters.push({ txhPartyId: queryDto.txhPartyId });
        if (queryDto.txhPartyMobile)
            filters.push({ txhPartyMobile: queryDto.txhPartyMobile });
        if (queryDto.txhStaffId)
            filters.push({ txhStaffId: queryDto.txhStaffId });
        if (queryDto.holdOnFrom) {
            filters.push({ txhHoldOn: { gte: this.parseDate(queryDto.holdOnFrom, 'holdOnFrom') } });
        }
        if (queryDto.holdOnTo) {
            filters.push({ txhHoldOn: { lte: this.parseDate(queryDto.holdOnTo, 'holdOnTo') } });
        }
        if (queryDto.expired !== undefined) {
            const now = new Date();
            filters.push(queryDto.expired
                ? { txhExpiresOn: { lt: now } }
                :
                    { OR: [{ txhExpiresOn: null }, { txhExpiresOn: { gte: now } }] });
        }
        if (queryDto.stockReserved !== undefined) {
            filters.push({ txhIsStockReserved: queryDto.stockReserved });
        }
        return {
            txhIsDeleted: false,
            ...(filters.length > 0 ? { AND: filters } : {}),
        };
    }
    hasStructuredFilters(queryDto) {
        return (queryDto.txhCompanyId !== undefined ||
            queryDto.txhBranchId !== undefined ||
            queryDto.txhAccYear !== undefined ||
            queryDto.txhKind !== undefined ||
            queryDto.txhSrcModule !== undefined ||
            queryDto.txhDocType !== undefined ||
            queryDto.txhStatus !== undefined ||
            queryDto.txhDeviceId !== undefined ||
            queryDto.txhCounterId !== undefined ||
            queryDto.txhSessionId !== undefined ||
            queryDto.txhHeldBy !== undefined ||
            queryDto.txhPartyType !== undefined ||
            queryDto.txhPartyId !== undefined ||
            queryDto.txhPartyMobile !== undefined ||
            queryDto.txhStaffId !== undefined ||
            queryDto.holdOnFrom !== undefined ||
            queryDto.holdOnTo !== undefined ||
            queryDto.expired !== undefined ||
            queryDto.stockReserved !== undefined);
    }
    mergedNumber(sent, stored) {
        if (sent !== undefined && sent !== null && typeof sent !== 'object') {
            const parsed = typeof sent === 'number' ? sent : Number(sent);
            return Number.isFinite(parsed) ? parsed : null;
        }
        if (stored !== undefined && stored !== null) {
            return (0, module_service_utils_1.toNumber)(stored);
        }
        return null;
    }
    parseDate(value, field) {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            (0, module_service_utils_1.throwSalesBadRequest)('Validation failed', [
                { field, message: `${field} must be a valid ISO-8601 date-time` },
            ]);
        }
        return parsed;
    }
    requireField(value, field) {
        if (!value) {
            (0, module_service_utils_1.throwSalesBadRequest)(`${field} is required`, [
                { field, message: `${field} must be provided when creating a hold` },
            ]);
        }
        return value;
    }
    requirePayload(value) {
        if (value === undefined ||
            value === null ||
            typeof value !== 'object' ||
            Array.isArray(value)) {
            (0, module_service_utils_1.throwSalesBadRequest)('txhPayload is required', [
                {
                    field: 'txhPayload',
                    message: 'txhPayload must be the module’s save body, as a JSON object',
                },
            ]);
        }
        return value;
    }
    requireAccYear(value, field) {
        const year = this.requireField(value, field).trim();
        if (!ACC_YEAR_PATTERN.test(year)) {
            (0, module_service_utils_1.throwSalesBadRequest)(`${field} is malformed`, [
                { field, message: `${field} must be an accounting year in the form YYYY-YYYY` },
            ]);
        }
        return year;
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Hold already exists', [
            {
                field: 'txhHoldNo',
                message: 'Duplicate txhHoldNo / txhHoldSlno for this company, branch, year, device and ' +
                    'document type, or a second live autosave for this screen',
            },
        ]);
    }
    throwNotFound(txhId) {
        (0, module_service_utils_1.throwSalesNotFound)('Hold not found', 'txhId', `No active hold found with id ${txhId}`);
    }
    displayName(record) {
        return record.txhHoldNo?.trim() || record.txhId;
    }
    toPayload(record) {
        return {
            txhId: record.txhId,
            txhCompanyId: record.txhCompanyId,
            txhBranchId: record.txhBranchId,
            txhTenantId: record.txhTenantId,
            txhAccYear: record.txhAccYear.trim(),
            txhKind: record.txhKind,
            txhSrcModule: record.txhSrcModule,
            txhDocType: record.txhDocType,
            txhHoldNo: record.txhHoldNo,
            txhHoldSlno: record.txhHoldSlno,
            txhHoldOn: record.txhHoldOn.toISOString(),
            txhDeviceId: record.txhDeviceId,
            txhCounterId: record.txhCounterId,
            txhSessionId: record.txhSessionId,
            txhHeldBy: record.txhHeldBy,
            txhPartyType: record.txhPartyType,
            txhPartyId: record.txhPartyId,
            txhPartyName: record.txhPartyName,
            txhPartyMobile: record.txhPartyMobile,
            txhStaffId: record.txhStaffId,
            txhRefLabel: record.txhRefLabel,
            txhItemCount: record.txhItemCount,
            txhTotalQty: (0, module_service_utils_1.toNumber)(record.txhTotalQty),
            txhNetAmount: (0, module_service_utils_1.toNumber)(record.txhNetAmount),
            txhPayload: record.txhPayload,
            txhPayloadVersion: record.txhPayloadVersion,
            txhRevision: record.txhRevision,
            txhStatus: record.txhStatus,
            txhHoldReason: record.txhHoldReason,
            txhRemarks: record.txhRemarks,
            txhExpiresOn: record.txhExpiresOn ? record.txhExpiresOn.toISOString() : null,
            txhLockedBy: record.txhLockedBy,
            txhLockedDeviceId: record.txhLockedDeviceId,
            txhLockedOn: record.txhLockedOn ? record.txhLockedOn.toISOString() : null,
            txhLockExpiresOn: record.txhLockExpiresOn ? record.txhLockExpiresOn.toISOString() : null,
            txhLockToken: record.txhLockToken,
            txhResumedBy: record.txhResumedBy,
            txhResumedOn: record.txhResumedOn ? record.txhResumedOn.toISOString() : null,
            txhResumeCount: record.txhResumeCount,
            txhConvertedDocId: record.txhConvertedDocId,
            txhConvertedAccYear: record.txhConvertedAccYear ? record.txhConvertedAccYear.trim() : null,
            txhConvertedRefno: record.txhConvertedRefno,
            txhConvertedOn: record.txhConvertedOn ? record.txhConvertedOn.toISOString() : null,
            txhConvertedBy: record.txhConvertedBy,
            txhIsStockReserved: record.txhIsStockReserved,
            txhPrintCount: record.txhPrintCount,
            txhLastPrintedOn: record.txhLastPrintedOn ? record.txhLastPrintedOn.toISOString() : null,
            txhIsDeleted: record.txhIsDeleted,
            txhSyncDate: record.txhSyncDate ? record.txhSyncDate.toISOString() : null,
            txhCreatedOn: record.txhCreatedOn.toISOString(),
            txhCreatedBy: record.txhCreatedBy,
            txhModifiedOn: record.txhModifiedOn ? record.txhModifiedOn.toISOString() : null,
            txhModifiedBy: record.txhModifiedBy,
        };
    }
};
exports.TxnHoldService = TxnHoldService;
exports.TxnHoldService = TxnHoldService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        configured_grid_sql_service_1.ConfiguredGridSqlService,
        request_context_service_1.RequestContextService])
], TxnHoldService);
//# sourceMappingURL=txn-hold.service.js.map