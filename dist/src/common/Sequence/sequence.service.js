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
exports.SequenceService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const module_service_utils_1 = require("../utils/module-service.utils");
const MAX_LIMIT = 100;
const DEFAULT_DEVICE_CODE = 'MAIN';
const DEFAULT_NO_WIDTH = 5;
const SEQUENCE_LAST_NO_LOCK_NAMESPACE = 'accounts.acc_voucher_seq.last_no';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let SequenceService = class SequenceService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async save(saveSequenceDto) {
        if (saveSequenceDto.id) {
            return this.update(saveSequenceDto.id, saveSequenceDto);
        }
        return this.create(saveSequenceDto);
    }
    async create(createSequenceDto) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const scope = this.buildCreateScope(createSequenceDto);
                const deviceId = this.normalizeOptionalNullableUuid(createSequenceDto.deviceId, 'deviceId') ?? null;
                const lastNoScope = {
                    companyId: scope.companyId,
                    branchId: scope.branchId,
                    accYear: scope.accYear,
                    deviceId,
                };
                await this.ensureReferencesExist(tx, scope);
                await this.acquireLastNoScopeLock(tx, lastNoScope);
                const nextLastNo = await this.getNextLastNo(tx, lastNoScope);
                const existingSequence = await this.findSequenceByScope(tx, scope);
                if (existingSequence) {
                    const updated = await tx.accVoucherSeq.update({
                        where: {
                            id: existingSequence.id,
                        },
                        data: this.buildDuplicateScopeUpdateData(createSequenceDto, nextLastNo),
                    });
                    return this.toPayload(updated);
                }
                const data = {
                    ...scope,
                    deviceId,
                    lastNo: nextLastNo,
                };
                const noWidth = this.normalizeOptionalInteger(createSequenceDto.noWidth, 'noWidth', {
                    min: 1,
                });
                if (noWidth !== undefined) {
                    data.noWidth = noWidth;
                }
                else {
                    data.noWidth = DEFAULT_NO_WIDTH;
                }
                this.assignOptionalCreateFields(data, createSequenceDto);
                const created = await tx.accVoucherSeq.create({ data });
                return this.toPayload(created);
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async findAll(queryDto = {}) {
        const page = this.normalizeOptionalInteger(queryDto.page, 'page', { min: 1 }) ?? module_service_utils_1.DEFAULT_PAGE;
        const limit = this.normalizeOptionalInteger(queryDto.limit, 'limit', { min: 1, max: MAX_LIMIT }) ??
            module_service_utils_1.DEFAULT_LIMIT;
        const skip = (page - 1) * limit;
        const where = this.buildListWhere(queryDto);
        const [total, records] = await Promise.all([
            this.prisma.accVoucherSeq.count({ where }),
            this.prisma.accVoucherSeq.findMany({
                where,
                orderBy: [
                    { accYear: 'desc' },
                    { vchrTypeId: 'asc' },
                    { companyId: 'asc' },
                    { branchId: 'asc' },
                    { deviceCode: 'asc' },
                    { periodKey: 'asc' },
                ],
                skip,
                take: limit,
            }),
        ]);
        return {
            items: records.map((record) => this.toPayload(record)),
            meta: {
                page,
                limit,
                total,
                total_pages: Math.ceil(total / limit),
            },
        };
    }
    async list(queryDto = {}) {
        return this.findAll(queryDto);
    }
    async findOne(id) {
        const sequenceId = this.normalizeUuid(id, 'id');
        const record = await this.prisma.accVoucherSeq.findFirst({
            where: {
                id: sequenceId,
                isDeleted: false,
            },
        });
        if (!record) {
            (0, module_service_utils_1.throwNotFound)('Sequence not found', 'id', `No active sequence found with id ${id}`);
        }
        return this.toPayload(record);
    }
    async getById(id) {
        return this.findOne(id);
    }
    async update(id, updateSequenceDto) {
        const sequenceId = this.normalizeUuid(id, 'id');
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.accVoucherSeq.findFirst({
                    where: {
                        id: sequenceId,
                        isDeleted: false,
                    },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwNotFound)('Sequence not found', 'id', `No active sequence found with id ${id}`);
                }
                const scope = this.resolveUpdateScope(existing, updateSequenceDto);
                await this.ensureReferencesExist(tx, scope);
                await this.ensureScopeIsUnique(tx, scope, sequenceId);
                const data = this.buildUpdateData(updateSequenceDto);
                const lastNoScope = this.resolveLastNoScope(existing, updateSequenceDto, scope);
                if (this.hasLastNoScopeChanged(existing, lastNoScope)) {
                    await this.acquireLastNoScopeLock(tx, lastNoScope);
                    data.lastNo = await this.getNextLastNo(tx, lastNoScope, sequenceId);
                }
                const updated = await tx.accVoucherSeq.update({
                    where: {
                        id: sequenceId,
                    },
                    data,
                });
                return this.toPayload(updated);
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async softDelete(id, modifiedBy) {
        const sequenceId = this.normalizeUuid(id, 'id');
        const normalizedModifiedBy = this.normalizeOptionalNullableUuid(modifiedBy, 'modifiedBy');
        const result = await this.prisma.accVoucherSeq.updateMany({
            where: {
                id: sequenceId,
                isDeleted: false,
            },
            data: {
                isActive: false,
                isDeleted: true,
                modifiedOn: new Date(),
                ...(normalizedModifiedBy !== undefined ? { modifiedBy: normalizedModifiedBy } : {}),
            },
        });
        if (result.count === 0) {
            (0, module_service_utils_1.throwNotFound)('Sequence not found', 'id', `No active sequence found with id ${id}`);
        }
        return {
            id: sequenceId,
            deleted: true,
        };
    }
    async remove(id, modifiedBy) {
        return this.softDelete(id, modifiedBy);
    }
    buildCreateScope(createSequenceDto) {
        return {
            vchrTypeId: this.normalizeRequiredInteger(createSequenceDto.vchrTypeId, 'vchrTypeId', {
                min: 1,
            }),
            companyId: this.normalizeUuid(createSequenceDto.companyId, 'companyId'),
            branchId: this.normalizeUuid(createSequenceDto.branchId, 'branchId'),
            accYear: this.normalizeRequiredString(createSequenceDto.accYear, 'accYear', 9),
            deviceCode: this.normalizeOptionalString(createSequenceDto.deviceCode, 'deviceCode', 20) ??
                DEFAULT_DEVICE_CODE,
            periodKey: this.normalizeRequiredString(createSequenceDto.periodKey, 'periodKey', 20),
        };
    }
    resolveUpdateScope(existing, updateSequenceDto) {
        return {
            vchrTypeId: updateSequenceDto.vchrTypeId !== undefined
                ? this.normalizeRequiredInteger(updateSequenceDto.vchrTypeId, 'vchrTypeId', { min: 1 })
                : existing.vchrTypeId,
            companyId: updateSequenceDto.companyId !== undefined
                ? this.normalizeUuid(updateSequenceDto.companyId, 'companyId')
                : existing.companyId,
            branchId: updateSequenceDto.branchId !== undefined
                ? this.normalizeUuid(updateSequenceDto.branchId, 'branchId')
                : existing.branchId,
            accYear: updateSequenceDto.accYear !== undefined
                ? this.normalizeRequiredString(updateSequenceDto.accYear, 'accYear', 9)
                : existing.accYear,
            deviceCode: updateSequenceDto.deviceCode !== undefined
                ? this.normalizeRequiredString(updateSequenceDto.deviceCode, 'deviceCode', 20)
                : existing.deviceCode,
            periodKey: updateSequenceDto.periodKey !== undefined
                ? this.normalizeRequiredString(updateSequenceDto.periodKey, 'periodKey', 20)
                : existing.periodKey,
        };
    }
    buildUpdateData(updateSequenceDto) {
        const data = {
            modifiedOn: new Date(),
        };
        if (updateSequenceDto.vchrTypeId !== undefined) {
            data.vchrTypeId = this.normalizeRequiredInteger(updateSequenceDto.vchrTypeId, 'vchrTypeId', {
                min: 1,
            });
        }
        if (updateSequenceDto.companyId !== undefined) {
            data.companyId = this.normalizeUuid(updateSequenceDto.companyId, 'companyId');
        }
        if (updateSequenceDto.branchId !== undefined) {
            data.branchId = this.normalizeUuid(updateSequenceDto.branchId, 'branchId');
        }
        if (updateSequenceDto.accYear !== undefined) {
            data.accYear = this.normalizeRequiredString(updateSequenceDto.accYear, 'accYear', 9);
        }
        if (updateSequenceDto.deviceId !== undefined) {
            data.deviceId = this.normalizeOptionalNullableUuid(updateSequenceDto.deviceId, 'deviceId');
        }
        if (updateSequenceDto.deviceCode !== undefined) {
            data.deviceCode = this.normalizeRequiredString(updateSequenceDto.deviceCode, 'deviceCode', 20);
        }
        if (updateSequenceDto.periodKey !== undefined) {
            data.periodKey = this.normalizeRequiredString(updateSequenceDto.periodKey, 'periodKey', 20);
        }
        this.assignOptionalUpdateFields(data, updateSequenceDto);
        return data;
    }
    buildDuplicateScopeUpdateData(createSequenceDto, lastNo) {
        const data = {
            lastNo,
            isDeleted: false,
            modifiedOn: new Date(),
        };
        const deviceId = this.normalizeOptionalNullableUuid(createSequenceDto.deviceId, 'deviceId');
        if (deviceId !== undefined) {
            data.deviceId = deviceId;
        }
        const noWidth = this.normalizeOptionalInteger(createSequenceDto.noWidth, 'noWidth', {
            min: 1,
        });
        if (noWidth !== undefined) {
            data.noWidth = noWidth;
        }
        const isActive = this.normalizeOptionalBoolean(createSequenceDto.isActive, 'isActive');
        if (isActive !== undefined) {
            data.isActive = isActive;
        }
        else {
            data.isActive = true;
        }
        this.assignOptionalTextFields(data, createSequenceDto);
        return data;
    }
    buildListWhere(queryDto) {
        const includeDeleted = this.normalizeOptionalBoolean(queryDto.includeDeleted, 'includeDeleted') ?? false;
        const where = includeDeleted ? {} : { isDeleted: false };
        if (queryDto.vchrTypeId !== undefined) {
            where.vchrTypeId = this.normalizeRequiredInteger(queryDto.vchrTypeId, 'vchrTypeId', {
                min: 1,
            });
        }
        if (queryDto.companyId !== undefined) {
            where.companyId = this.normalizeUuid(queryDto.companyId, 'companyId');
        }
        if (queryDto.branchId !== undefined) {
            where.branchId = this.normalizeUuid(queryDto.branchId, 'branchId');
        }
        if (queryDto.accYear !== undefined) {
            where.accYear = this.normalizeRequiredString(queryDto.accYear, 'accYear', 9);
        }
        if (queryDto.deviceId !== undefined) {
            where.deviceId = this.normalizeOptionalNullableUuid(queryDto.deviceId, 'deviceId');
        }
        if (queryDto.deviceCode !== undefined) {
            where.deviceCode = this.normalizeRequiredString(queryDto.deviceCode, 'deviceCode', 20);
        }
        if (queryDto.periodKey !== undefined) {
            where.periodKey = this.normalizeRequiredString(queryDto.periodKey, 'periodKey', 20);
        }
        if (queryDto.isActive !== undefined) {
            where.isActive = this.normalizeOptionalBoolean(queryDto.isActive, 'isActive');
        }
        if (queryDto.search?.trim()) {
            const search = queryDto.search.trim();
            const searchFilters = [
                { accYear: { contains: search, mode: 'insensitive' } },
                { deviceCode: { contains: search, mode: 'insensitive' } },
                { periodKey: { contains: search, mode: 'insensitive' } },
                { voucherPrefix: { contains: search, mode: 'insensitive' } },
                { companyCode: { contains: search, mode: 'insensitive' } },
                { branchCode: { contains: search, mode: 'insensitive' } },
                { voucherSuffix: { contains: search, mode: 'insensitive' } },
                { lastRefno: { contains: search, mode: 'insensitive' } },
            ];
            if (this.isUuid(search)) {
                searchFilters.push({ id: search });
            }
            where.OR = searchFilters;
        }
        return where;
    }
    assignOptionalCreateFields(data, createSequenceDto) {
        const isActive = this.normalizeOptionalBoolean(createSequenceDto.isActive, 'isActive');
        if (isActive !== undefined) {
            data.isActive = isActive;
        }
        const createdBy = this.normalizeOptionalNullableUuid(createSequenceDto.createdBy, 'createdBy');
        if (createdBy !== undefined) {
            data.createdBy = createdBy;
        }
        this.assignOptionalTextFields(data, createSequenceDto);
    }
    assignOptionalUpdateFields(data, updateSequenceDto) {
        if (updateSequenceDto.noWidth !== undefined) {
            data.noWidth = this.normalizeRequiredInteger(updateSequenceDto.noWidth, 'noWidth', {
                min: 1,
            });
        }
        if (updateSequenceDto.isActive !== undefined) {
            data.isActive = this.normalizeOptionalBoolean(updateSequenceDto.isActive, 'isActive');
        }
        if (updateSequenceDto.modifiedBy !== undefined) {
            data.modifiedBy = this.normalizeOptionalNullableUuid(updateSequenceDto.modifiedBy, 'modifiedBy');
        }
        this.assignOptionalTextFields(data, updateSequenceDto);
    }
    assignOptionalTextFields(data, dto) {
        if (dto.voucherPrefix !== undefined) {
            data.voucherPrefix = this.normalizeNullableString(dto.voucherPrefix, 'voucherPrefix', 20);
        }
        if (dto.companyCode !== undefined) {
            data.companyCode = this.normalizeNullableString(dto.companyCode, 'companyCode', 20);
        }
        if (dto.branchCode !== undefined) {
            data.branchCode = this.normalizeNullableString(dto.branchCode, 'branchCode', 20);
        }
        if (dto.voucherSuffix !== undefined) {
            data.voucherSuffix = this.normalizeNullableString(dto.voucherSuffix, 'voucherSuffix', 20);
        }
        if (dto.lastRefno !== undefined) {
            data.lastRefno = this.normalizeNullableString(dto.lastRefno, 'lastRefno', 100);
        }
    }
    async ensureReferencesExist(client, scope) {
        const [voucherType, company, branch] = await Promise.all([
            client.accVoucherType.findFirst({
                where: {
                    vchrTypeId: scope.vchrTypeId,
                },
                select: {
                    vchrTypeId: true,
                },
            }),
            client.company.findFirst({
                where: {
                    compId: scope.companyId,
                    compIsDeleted: false,
                },
                select: {
                    compId: true,
                },
            }),
            client.branchMaster.findFirst({
                where: {
                    brId: scope.branchId,
                    brCompId: scope.companyId,
                    brIsDeleted: false,
                },
                select: {
                    brId: true,
                },
            }),
        ]);
        if (!voucherType) {
            (0, module_service_utils_1.throwBadRequest)('Voucher type does not exist', [
                {
                    field: 'vchrTypeId',
                    message: `No voucher type found with id ${scope.vchrTypeId}`,
                },
            ]);
        }
        if (!company) {
            (0, module_service_utils_1.throwBadRequest)('Company does not exist', [
                {
                    field: 'companyId',
                    message: `No active company found with id ${scope.companyId}`,
                },
            ]);
        }
        if (!branch) {
            (0, module_service_utils_1.throwBadRequest)('Branch does not exist', [
                {
                    field: 'branchId',
                    message: `No active branch found with id ${scope.branchId} for company ${scope.companyId}`,
                },
            ]);
        }
    }
    async ensureScopeIsUnique(client, scope, excludeId) {
        const existing = await client.accVoucherSeq.findFirst({
            where: {
                vchrTypeId: scope.vchrTypeId,
                companyId: scope.companyId,
                branchId: scope.branchId,
                accYear: scope.accYear,
                deviceCode: scope.deviceCode,
                periodKey: scope.periodKey,
                ...(excludeId ? { id: { not: excludeId } } : {}),
            },
            select: {
                id: true,
            },
        });
        if (existing) {
            (0, module_service_utils_1.throwConflict)('Sequence scope already exists', [
                {
                    field: 'scope',
                    message: 'Duplicate vchrTypeId, companyId, branchId, accYear, deviceCode, and periodKey values are not allowed',
                },
            ]);
        }
    }
    async findSequenceByScope(client, scope) {
        return client.accVoucherSeq.findFirst({
            where: {
                vchrTypeId: scope.vchrTypeId,
                companyId: scope.companyId,
                branchId: scope.branchId,
                accYear: scope.accYear,
                deviceCode: scope.deviceCode,
                periodKey: scope.periodKey,
            },
        });
    }
    resolveLastNoScope(existing, updateSequenceDto, scope) {
        return {
            companyId: scope.companyId,
            branchId: scope.branchId,
            accYear: scope.accYear,
            deviceId: updateSequenceDto.deviceId !== undefined
                ? (this.normalizeOptionalNullableUuid(updateSequenceDto.deviceId, 'deviceId') ?? null)
                : existing.deviceId,
        };
    }
    hasLastNoScopeChanged(existing, lastNoScope) {
        return (existing.companyId !== lastNoScope.companyId ||
            existing.branchId !== lastNoScope.branchId ||
            existing.accYear !== lastNoScope.accYear ||
            existing.deviceId !== lastNoScope.deviceId);
    }
    async acquireLastNoScopeLock(client, scope) {
        await client.$queryRaw `
      WITH advisory_lock AS (
        SELECT pg_advisory_xact_lock(
          hashtext(${SEQUENCE_LAST_NO_LOCK_NAMESPACE}),
          hashtext(${this.buildLastNoScopeKey(scope)})
        )
      )
      SELECT 1::int AS locked
    `;
    }
    async getNextLastNo(client, scope, excludeId) {
        const latestSequence = await client.accVoucherSeq.findFirst({
            where: {
                companyId: scope.companyId,
                branchId: scope.branchId,
                accYear: scope.accYear,
                deviceId: scope.deviceId,
                ...(excludeId ? { id: { not: excludeId } } : {}),
            },
            orderBy: {
                lastNo: 'desc',
            },
            select: {
                lastNo: true,
            },
        });
        return (latestSequence?.lastNo ?? BigInt(0)) + BigInt(1);
    }
    buildLastNoScopeKey(scope) {
        return [scope.companyId, scope.branchId, scope.accYear, scope.deviceId ?? 'NO_DEVICE'].join('|');
    }
    toPayload(record) {
        return {
            id: record.id,
            vchrTypeId: record.vchrTypeId,
            companyId: record.companyId,
            branchId: record.branchId,
            accYear: record.accYear,
            deviceId: record.deviceId,
            deviceCode: record.deviceCode,
            periodKey: record.periodKey,
            lastNo: record.lastNo.toString(),
            voucherPrefix: record.voucherPrefix,
            companyCode: record.companyCode,
            branchCode: record.branchCode,
            voucherSuffix: record.voucherSuffix,
            noWidth: record.noWidth,
            lastRefno: record.lastRefno,
            isActive: record.isActive,
            isDeleted: record.isDeleted,
            createdOn: record.createdOn.toISOString(),
            createdBy: record.createdBy,
            modifiedOn: record.modifiedOn ? record.modifiedOn.toISOString() : null,
            modifiedBy: record.modifiedBy,
        };
    }
    normalizeUuid(value, field) {
        if (typeof value !== 'string' || !this.isUuid(value.trim())) {
            (0, module_service_utils_1.throwBadRequest)('Validation failed', [
                {
                    field,
                    message: `${field} must be a valid UUID`,
                },
            ]);
        }
        return value.trim();
    }
    normalizeOptionalNullableUuid(value, field) {
        if (value === undefined) {
            return undefined;
        }
        if (value === null || value === '') {
            return null;
        }
        return this.normalizeUuid(value, field);
    }
    normalizeRequiredString(value, field, maxLength) {
        if (typeof value !== 'string') {
            (0, module_service_utils_1.throwBadRequest)('Validation failed', [
                {
                    field,
                    message: `${field} must be a string`,
                },
            ]);
        }
        const trimmed = value.trim();
        if (!trimmed) {
            (0, module_service_utils_1.throwBadRequest)('Validation failed', [
                {
                    field,
                    message: `${field} must not be empty`,
                },
            ]);
        }
        if (trimmed.length > maxLength) {
            (0, module_service_utils_1.throwBadRequest)('Validation failed', [
                {
                    field,
                    message: `${field} must be ${maxLength} characters or less`,
                },
            ]);
        }
        return trimmed;
    }
    normalizeOptionalString(value, field, maxLength) {
        if (value === undefined || value === null || value === '') {
            return undefined;
        }
        return this.normalizeRequiredString(value, field, maxLength);
    }
    normalizeNullableString(value, field, maxLength) {
        if (value === null || value === '') {
            return null;
        }
        return this.normalizeRequiredString(value, field, maxLength);
    }
    normalizeRequiredInteger(value, field, options = {}) {
        const parsed = this.parseInteger(value, field);
        if (options.min !== undefined && parsed < options.min) {
            (0, module_service_utils_1.throwBadRequest)('Validation failed', [
                {
                    field,
                    message: `${field} must be greater than or equal to ${options.min}`,
                },
            ]);
        }
        if (options.max !== undefined && parsed > options.max) {
            (0, module_service_utils_1.throwBadRequest)('Validation failed', [
                {
                    field,
                    message: `${field} must be less than or equal to ${options.max}`,
                },
            ]);
        }
        return parsed;
    }
    normalizeOptionalInteger(value, field, options = {}) {
        if (value === undefined || value === null || value === '') {
            return undefined;
        }
        return this.normalizeRequiredInteger(value, field, options);
    }
    parseInteger(value, field) {
        const parsed = typeof value === 'number'
            ? value
            : typeof value === 'string' && value.trim() !== ''
                ? Number(value.trim())
                : Number.NaN;
        if (!Number.isSafeInteger(parsed)) {
            (0, module_service_utils_1.throwBadRequest)('Validation failed', [
                {
                    field,
                    message: `${field} must be a valid integer`,
                },
            ]);
        }
        return parsed;
    }
    normalizeRequiredBigInt(value, field) {
        if (typeof value === 'bigint') {
            if (value < BigInt(0)) {
                this.throwBigIntRangeError(field);
            }
            return value;
        }
        if (typeof value === 'number') {
            if (!Number.isSafeInteger(value) || value < 0) {
                this.throwBigIntRangeError(field);
            }
            return BigInt(value);
        }
        if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
            return BigInt(value.trim());
        }
        this.throwBigIntRangeError(field);
    }
    normalizeOptionalBigInt(value, field) {
        if (value === undefined || value === null || value === '') {
            return undefined;
        }
        return this.normalizeRequiredBigInt(value, field);
    }
    throwBigIntRangeError(field) {
        (0, module_service_utils_1.throwBadRequest)('Validation failed', [
            {
                field,
                message: `${field} must be a valid non-negative integer`,
            },
        ]);
    }
    normalizeOptionalBoolean(value, field) {
        if (value === undefined || value === null || value === '') {
            return undefined;
        }
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (['1', 'true', 'yes', 'on'].includes(normalized)) {
                return true;
            }
            if (['0', 'false', 'no', 'off'].includes(normalized)) {
                return false;
            }
        }
        (0, module_service_utils_1.throwBadRequest)('Validation failed', [
            {
                field,
                message: `${field} must be a boolean`,
            },
        ]);
    }
    isUuid(value) {
        return UUID_REGEX.test(value);
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Sequence scope already exists', [
            {
                field: 'scope',
                message: 'Duplicate vchrTypeId, companyId, branchId, accYear, deviceCode, and periodKey values are not allowed',
            },
        ]);
    }
};
exports.SequenceService = SequenceService;
exports.SequenceService = SequenceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SequenceService);
//# sourceMappingURL=sequence.service.js.map