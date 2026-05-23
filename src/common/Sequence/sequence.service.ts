import { Injectable } from '@nestjs/common';
import { AccVoucherSeq, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateSequenceDto } from './dto/create-sequence.dto';
import { ListSequenceQueryDto } from './dto/list-sequence-query.dto';
import { SaveSequenceDto } from './dto/save-sequence.dto';
import { UpdateSequenceDto } from './dto/update-sequence.dto';
import {
  SequenceErrorDetail,
  SequenceListResult,
  SequencePayload,
} from './types/sequence-api.types';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  throwBadRequest,
  throwConflict,
  throwNotFound,
  throwOnUniqueConstraintError,
} from 'src/common/utils/module-service.utils';
const MAX_LIMIT = 100;
const DEFAULT_DEVICE_CODE = 'MAIN';
const DEFAULT_NO_WIDTH = 5;
const SEQUENCE_LAST_NO_LOCK_NAMESPACE = 'accounts.acc_voucher_seq.last_no';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type SequenceWriteClient = Prisma.TransactionClient | PrismaService;
type SequenceScope = Pick<
  AccVoucherSeq,
  'vchrTypeId' | 'companyId' | 'branchId' | 'accYear' | 'deviceCode' | 'periodKey'
>;
type SequenceLastNoScope = Pick<AccVoucherSeq, 'companyId' | 'branchId' | 'accYear' | 'deviceId'>;
@Injectable()
export class SequenceService {
  constructor(private readonly prisma: PrismaService) {}
  async save(saveSequenceDto: SaveSequenceDto): Promise<SequencePayload> {
    if (saveSequenceDto.id) {
      return this.update(saveSequenceDto.id, saveSequenceDto);
    }
    return this.create(saveSequenceDto);
  }
  async create(createSequenceDto: CreateSequenceDto): Promise<SequencePayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const scope = this.buildCreateScope(createSequenceDto);
        const deviceId =
          this.normalizeOptionalNullableUuid(createSequenceDto.deviceId, 'deviceId') ?? null;
        const lastNoScope: SequenceLastNoScope = {
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

        const data: Prisma.AccVoucherSeqUncheckedCreateInput = {
          ...scope,
          deviceId,
          lastNo: nextLastNo,
        };
        const noWidth = this.normalizeOptionalInteger(createSequenceDto.noWidth, 'noWidth', {
          min: 1,
        });
        if (noWidth !== undefined) {
          data.noWidth = noWidth;
        } else {
          data.noWidth = DEFAULT_NO_WIDTH;
        }
        this.assignOptionalCreateFields(data, createSequenceDto);
        const created = await tx.accVoucherSeq.create({ data });
        return this.toPayload(created);
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  async findAll(queryDto: ListSequenceQueryDto = {}): Promise<SequenceListResult> {
    const page = this.normalizeOptionalInteger(queryDto.page, 'page', { min: 1 }) ?? DEFAULT_PAGE;
    const limit =
      this.normalizeOptionalInteger(queryDto.limit, 'limit', { min: 1, max: MAX_LIMIT }) ??
      DEFAULT_LIMIT;
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
  async list(queryDto: ListSequenceQueryDto = {}): Promise<SequenceListResult> {
    return this.findAll(queryDto);
  }
  async findOne(id: string): Promise<SequencePayload> {
    const sequenceId = this.normalizeUuid(id, 'id');
    const record = await this.prisma.accVoucherSeq.findFirst({
      where: {
        id: sequenceId,
        isDeleted: false,
      },
    });
    if (!record) {
      throwNotFound<SequenceErrorDetail>('Sequence not found', 'id', `No active sequence found with id ${id}`);
    }
    return this.toPayload(record);
  }
  async getById(id: string): Promise<SequencePayload> {
    return this.findOne(id);
  }
  async update(id: string, updateSequenceDto: UpdateSequenceDto): Promise<SequencePayload> {
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
          throwNotFound<SequenceErrorDetail>('Sequence not found', 'id', `No active sequence found with id ${id}`);
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
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  async softDelete(id: string, modifiedBy?: string | null): Promise<{ id: string; deleted: true }> {
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
      throwNotFound<SequenceErrorDetail>('Sequence not found', 'id', `No active sequence found with id ${id}`);
    }
    return {
      id: sequenceId,
      deleted: true,
    };
  }
  async remove(id: string, modifiedBy?: string | null): Promise<{ id: string; deleted: true }> {
    return this.softDelete(id, modifiedBy);
  }
  private buildCreateScope(createSequenceDto: CreateSequenceDto): SequenceScope {
    return {
      vchrTypeId: this.normalizeRequiredInteger(createSequenceDto.vchrTypeId, 'vchrTypeId', {
        min: 1,
      }),
      companyId: this.normalizeUuid(createSequenceDto.companyId, 'companyId'),
      branchId: this.normalizeUuid(createSequenceDto.branchId, 'branchId'),
      accYear: this.normalizeRequiredString(createSequenceDto.accYear, 'accYear', 9),
      deviceCode:
        this.normalizeOptionalString(createSequenceDto.deviceCode, 'deviceCode', 20) ??
        DEFAULT_DEVICE_CODE,
      periodKey: this.normalizeRequiredString(createSequenceDto.periodKey, 'periodKey', 20),
    };
  }
  private resolveUpdateScope(
    existing: AccVoucherSeq,
    updateSequenceDto: UpdateSequenceDto,
  ): SequenceScope {
    return {
      vchrTypeId:
        updateSequenceDto.vchrTypeId !== undefined
          ? this.normalizeRequiredInteger(updateSequenceDto.vchrTypeId, 'vchrTypeId', { min: 1 })
          : existing.vchrTypeId,
      companyId:
        updateSequenceDto.companyId !== undefined
          ? this.normalizeUuid(updateSequenceDto.companyId, 'companyId')
          : existing.companyId,
      branchId:
        updateSequenceDto.branchId !== undefined
          ? this.normalizeUuid(updateSequenceDto.branchId, 'branchId')
          : existing.branchId,
      accYear:
        updateSequenceDto.accYear !== undefined
          ? this.normalizeRequiredString(updateSequenceDto.accYear, 'accYear', 9)
          : existing.accYear,
      deviceCode:
        updateSequenceDto.deviceCode !== undefined
          ? this.normalizeRequiredString(updateSequenceDto.deviceCode, 'deviceCode', 20)
          : existing.deviceCode,
      periodKey:
        updateSequenceDto.periodKey !== undefined
          ? this.normalizeRequiredString(updateSequenceDto.periodKey, 'periodKey', 20)
          : existing.periodKey,
    };
  }
  private buildUpdateData(
    updateSequenceDto: UpdateSequenceDto,
  ): Prisma.AccVoucherSeqUncheckedUpdateInput {
    const data: Prisma.AccVoucherSeqUncheckedUpdateInput = {
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
      data.deviceCode = this.normalizeRequiredString(
        updateSequenceDto.deviceCode,
        'deviceCode',
        20,
      );
    }
    if (updateSequenceDto.periodKey !== undefined) {
      data.periodKey = this.normalizeRequiredString(updateSequenceDto.periodKey, 'periodKey', 20);
    }
    this.assignOptionalUpdateFields(data, updateSequenceDto);
    return data;
  }

  private buildDuplicateScopeUpdateData(
    createSequenceDto: CreateSequenceDto,
    lastNo: bigint,
  ): Prisma.AccVoucherSeqUncheckedUpdateInput {
    const data: Prisma.AccVoucherSeqUncheckedUpdateInput = {
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
    } else {
      data.isActive = true;
    }

    this.assignOptionalTextFields(data, createSequenceDto);

    return data;
  }

  private buildListWhere(queryDto: ListSequenceQueryDto): Prisma.AccVoucherSeqWhereInput {
    const includeDeleted =
      this.normalizeOptionalBoolean(queryDto.includeDeleted, 'includeDeleted') ?? false;
    const where: Prisma.AccVoucherSeqWhereInput = includeDeleted ? {} : { isDeleted: false };
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
      const searchFilters: Prisma.AccVoucherSeqWhereInput[] = [
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
  private assignOptionalCreateFields(
    data: Prisma.AccVoucherSeqUncheckedCreateInput,
    createSequenceDto: CreateSequenceDto,
  ): void {
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
  private assignOptionalUpdateFields(
    data: Prisma.AccVoucherSeqUncheckedUpdateInput,
    updateSequenceDto: UpdateSequenceDto,
  ): void {
    if (updateSequenceDto.noWidth !== undefined) {
      data.noWidth = this.normalizeRequiredInteger(updateSequenceDto.noWidth, 'noWidth', {
        min: 1,
      });
    }
    if (updateSequenceDto.isActive !== undefined) {
      data.isActive = this.normalizeOptionalBoolean(updateSequenceDto.isActive, 'isActive');
    }
    if (updateSequenceDto.modifiedBy !== undefined) {
      data.modifiedBy = this.normalizeOptionalNullableUuid(
        updateSequenceDto.modifiedBy,
        'modifiedBy',
      );
    }
    this.assignOptionalTextFields(data, updateSequenceDto);
  }
  private assignOptionalTextFields(
    data: Prisma.AccVoucherSeqUncheckedCreateInput | Prisma.AccVoucherSeqUncheckedUpdateInput,
    dto: CreateSequenceDto | UpdateSequenceDto,
  ): void {
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
  private async ensureReferencesExist(
    client: SequenceWriteClient,
    scope: Pick<SequenceScope, 'vchrTypeId' | 'companyId' | 'branchId'>,
  ): Promise<void> {
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
          compId: scope.companyId,
          brIsDeleted: false,
        },
        select: {
          brId: true,
        },
      }),
    ]);

    if (!voucherType) {
      throwBadRequest<SequenceErrorDetail>('Voucher type does not exist', [
        {
          field: 'vchrTypeId',
          message: `No voucher type found with id ${scope.vchrTypeId}`,
        },
      ]);
    }

    if (!company) {
      throwBadRequest<SequenceErrorDetail>('Company does not exist', [
        {
          field: 'companyId',
          message: `No active company found with id ${scope.companyId}`,
        },
      ]);
    }

    if (!branch) {
      throwBadRequest<SequenceErrorDetail>('Branch does not exist', [
        {
          field: 'branchId',
          message: `No active branch found with id ${scope.branchId} for company ${scope.companyId}`,
        },
      ]);
    }
  }

  private async ensureScopeIsUnique(
    client: SequenceWriteClient,
    scope: SequenceScope,
    excludeId?: string,
  ): Promise<void> {
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
      throwConflict<SequenceErrorDetail>('Sequence scope already exists', [
        {
          field: 'scope',
          message:
            'Duplicate vchrTypeId, companyId, branchId, accYear, deviceCode, and periodKey values are not allowed',
        },
      ]);
    }
  }

  private async findSequenceByScope(
    client: SequenceWriteClient,
    scope: SequenceScope,
  ): Promise<AccVoucherSeq | null> {
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

  private resolveLastNoScope(
    existing: AccVoucherSeq,
    updateSequenceDto: UpdateSequenceDto,
    scope: SequenceScope,
  ): SequenceLastNoScope {
    return {
      companyId: scope.companyId,
      branchId: scope.branchId,
      accYear: scope.accYear,
      deviceId:
        updateSequenceDto.deviceId !== undefined
          ? (this.normalizeOptionalNullableUuid(updateSequenceDto.deviceId, 'deviceId') ?? null)
          : existing.deviceId,
    };
  }

  private hasLastNoScopeChanged(
    existing: AccVoucherSeq,
    lastNoScope: SequenceLastNoScope,
  ): boolean {
    return (
      existing.companyId !== lastNoScope.companyId ||
      existing.branchId !== lastNoScope.branchId ||
      existing.accYear !== lastNoScope.accYear ||
      existing.deviceId !== lastNoScope.deviceId
    );
  }

  private async acquireLastNoScopeLock(
    client: Prisma.TransactionClient,
    scope: SequenceLastNoScope,
  ): Promise<void> {
    await client.$queryRaw<Array<{ locked: number }>>`
      WITH advisory_lock AS (
        SELECT pg_advisory_xact_lock(
          hashtext(${SEQUENCE_LAST_NO_LOCK_NAMESPACE}),
          hashtext(${this.buildLastNoScopeKey(scope)})
        )
      )
      SELECT 1::int AS locked
    `;
  }

  private async getNextLastNo(
    client: SequenceWriteClient,
    scope: SequenceLastNoScope,
    excludeId?: string,
  ): Promise<bigint> {
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

  private buildLastNoScopeKey(scope: SequenceLastNoScope): string {
    return [scope.companyId, scope.branchId, scope.accYear, scope.deviceId ?? 'NO_DEVICE'].join(
      '|',
    );
  }

  private toPayload(record: AccVoucherSeq): SequencePayload {
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

  private normalizeUuid(value: unknown, field: string): string {
    if (typeof value !== 'string' || !this.isUuid(value.trim())) {
      throwBadRequest<SequenceErrorDetail>('Validation failed', [
        {
          field,
          message: `${field} must be a valid UUID`,
        },
      ]);
    }

    return value.trim();
  }

  private normalizeOptionalNullableUuid(value: unknown, field: string): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value === '') {
      return null;
    }

    return this.normalizeUuid(value, field);
  }

  private normalizeRequiredString(value: unknown, field: string, maxLength: number): string {
    if (typeof value !== 'string') {
      throwBadRequest<SequenceErrorDetail>('Validation failed', [
        {
          field,
          message: `${field} must be a string`,
        },
      ]);
    }

    const trimmed = value.trim();
    if (!trimmed) {
      throwBadRequest<SequenceErrorDetail>('Validation failed', [
        {
          field,
          message: `${field} must not be empty`,
        },
      ]);
    }

    if (trimmed.length > maxLength) {
      throwBadRequest<SequenceErrorDetail>('Validation failed', [
        {
          field,
          message: `${field} must be ${maxLength} characters or less`,
        },
      ]);
    }

    return trimmed;
  }

  private normalizeOptionalString(
    value: unknown,
    field: string,
    maxLength: number,
  ): string | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    return this.normalizeRequiredString(value, field, maxLength);
  }

  private normalizeNullableString(value: unknown, field: string, maxLength: number): string | null {
    if (value === null || value === '') {
      return null;
    }

    return this.normalizeRequiredString(value, field, maxLength);
  }

  private normalizeRequiredInteger(
    value: unknown,
    field: string,
    options: { min?: number; max?: number } = {},
  ): number {
    const parsed = this.parseInteger(value, field);

    if (options.min !== undefined && parsed < options.min) {
      throwBadRequest<SequenceErrorDetail>('Validation failed', [
        {
          field,
          message: `${field} must be greater than or equal to ${options.min}`,
        },
      ]);
    }

    if (options.max !== undefined && parsed > options.max) {
      throwBadRequest<SequenceErrorDetail>('Validation failed', [
        {
          field,
          message: `${field} must be less than or equal to ${options.max}`,
        },
      ]);
    }

    return parsed;
  }

  private normalizeOptionalInteger(
    value: unknown,
    field: string,
    options: { min?: number; max?: number } = {},
  ): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    return this.normalizeRequiredInteger(value, field, options);
  }

  private parseInteger(value: unknown, field: string): number {
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string' && value.trim() !== ''
          ? Number(value.trim())
          : Number.NaN;

    if (!Number.isSafeInteger(parsed)) {
      throwBadRequest<SequenceErrorDetail>('Validation failed', [
        {
          field,
          message: `${field} must be a valid integer`,
        },
      ]);
    }

    return parsed;
  }

  private normalizeRequiredBigInt(value: unknown, field: string): bigint {
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

  private normalizeOptionalBigInt(value: unknown, field: string): bigint | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    return this.normalizeRequiredBigInt(value, field);
  }

  private throwBigIntRangeError(field: string): never {
    throwBadRequest<SequenceErrorDetail>('Validation failed', [
      {
        field,
        message: `${field} must be a valid non-negative integer`,
      },
    ]);
  }

  private normalizeOptionalBoolean(value: unknown, field: string): boolean | undefined {
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

    throwBadRequest<SequenceErrorDetail>('Validation failed', [
      {
        field,
        message: `${field} must be a boolean`,
      },
    ]);
  }

  private isUuid(value: string): boolean {
    return UUID_REGEX.test(value);
  }

  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<SequenceErrorDetail>(error, 'Sequence scope already exists', [
      {
        field: 'scope',
        message:
          'Duplicate vchrTypeId, companyId, branchId, accYear, deviceCode, and periodKey values are not allowed',
      },
    ]);
  }
}
