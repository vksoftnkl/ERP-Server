import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditScreenType, Prisma } from '@prisma/client';
import { isIP } from 'node:net';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  AuditAction,
  CaptureScreenSnapshotInput,
  CreateAuditLogInput,
  LogEntityChangeInput,
} from './types/audit-log.types';
import { ListAuditLogQueryDto } from './dto/list-audit-log-query.dto';
import { AuditLogListItem, AuditLogListMeta } from './types/audit-log-api.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

type AuditWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class AuditLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async captureScreenSnapshot(
    input: CaptureScreenSnapshotInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.JsonValue | null> {
    const client = tx ?? this.prisma;
    const screen = await client.auditScreen.findFirst({
      where: {
        screenId: input.screenId,
        screenStatus: true,
      },
      select: {
        screenId: true,
      },
    });

    if (!screen) {
      throw new BadRequestException(`No active audit screen found with id ${input.screenId}`);
    }

    // Snapshot SQL templates are intentionally disabled.
    return null;
  }

  async list(
    queryDto: ListAuditLogQueryDto,
  ): Promise<{ items: AuditLogListItem[]; meta: AuditLogListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    if (queryDto.action?.trim()) {
      where.logAction = this.normalizeAction(queryDto.action) as
        | 'insert'
        | 'update'
        | 'approve'
        | 'cancel';
    }

    if (queryDto.screen_id !== undefined) {
      where.logScreenId = queryDto.screen_id;
    }

    const dateFrom = queryDto.date_from
      ? this.parseDateBoundary(queryDto.date_from, 'start')
      : undefined;
    const dateTo = queryDto.date_to ? this.parseDateBoundary(queryDto.date_to, 'end') : undefined;
    if (dateFrom && dateTo && dateFrom.getTime() > dateTo.getTime()) {
      throw new BadRequestException('date_from must be less than or equal to date_to');
    }
    if (dateFrom || dateTo) {
      where.logDate = {};
      if (dateFrom) {
        where.logDate.gte = dateFrom;
      }
      if (dateTo) {
        where.logDate.lte = dateTo;
      }
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { logTableName: { contains: search, mode: 'insensitive' } },
        { logPk: { contains: search, mode: 'insensitive' } },
        { logDisplayName: { contains: search, mode: 'insensitive' } },
        { logNotes: { contains: search, mode: 'insensitive' } },
        {
          auditScreen: {
            is: {
              screenName: { contains: search, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: {
          auditScreen: {
            select: {
              screenName: true,
            },
          },
        },
        orderBy: [{ logDate: 'desc' }, { logId: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: records.map((record) => this.toListItem(record)),
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async createAuditLog(input: CreateAuditLogInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    const action = this.normalizeAction(input.action);
    const prismaAction = action as unknown as Prisma.AuditLogUncheckedCreateInput['logAction'];
    const normalizedTableName = input.tableName.trim();
    if (!normalizedTableName) {
      throw new BadRequestException('tableName is required for audit log');
    }

    const resolvedUserId = this.resolveAuditUserId(input.userId);
    const resolvedIpAddress = this.resolveAuditIpAddress();

    const data: Prisma.AuditLogUncheckedCreateInput = {
      logAction: prismaAction,
      logScreenId: input.screenId,
      logTableName: normalizedTableName,
      logPk: this.normalizePk(input.pk),
      logDisplayName: this.normalizeOptionalText(input.displayName),
      logEntityId: this.normalizeUuid(input.entityId),
      logOriginalRecord: this.toJsonInput(input.originalRecord),
      logModifiedRecord: this.toJsonInput(input.modifiedRecord),
      logChangedFields: this.toJsonInput(input.changedFields),
      logUserId: resolvedUserId,
      logBranchId: this.normalizeUuid(input.branchId),
      logIp: resolvedIpAddress,
      logNotes: this.normalizeOptionalText(input.notes),
    };

    await client.auditLog.create({
      data,
    });
  }

  async logEntityChange(input: LogEntityChangeInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    const action = this.normalizeAction(input.action);
    const screenId = await this.resolveScreenId(input, client);
    const originalRecord = this.toNullableJson(input.originalRecord);

    const isModifiedRecordProvided = input.modifiedRecord !== undefined;
    let modifiedRecord = this.toNullableJson(input.modifiedRecord);

    if (!isModifiedRecordProvided) {
      const pk = this.normalizePk(input.pk);
      if (pk !== null) {
        modifiedRecord = await this.captureScreenSnapshot(
          {
            screenId,
            keyNo: pk,
            accYear: input.accYear ?? null,
          },
          tx,
        );
      }
    }

    if (!isModifiedRecordProvided && modifiedRecord === null) {
      throw new BadRequestException('modifiedRecord is required when auto snapshot is unavailable');
    }

    if (action === 'insert') {
      const insertOriginalRecord = originalRecord ?? modifiedRecord;
      if (insertOriginalRecord === null) {
        throw new BadRequestException(
          'originalRecord or modifiedRecord is required for insert audit log',
        );
      }

      await this.createAuditLog(
        {
          action,
          screenId,
          tableName: input.tableName,
          pk: input.pk,
          displayName: input.displayName,
          entityId: input.entityId,
          originalRecord: insertOriginalRecord,
          modifiedRecord: undefined,
          changedFields: undefined,
          userId: input.userId,
          branchId: input.branchId,
          notes: input.notes,
        },
        tx,
      );
      return;
    }

    if (action === 'update' && (originalRecord === null || modifiedRecord === null)) {
      throw new BadRequestException(
        'originalRecord and modifiedRecord are required for update audit log',
      );
    }

    const changedFields = this.computeChangedFields(originalRecord, modifiedRecord);
    await this.createAuditLog(
      {
        action,
        screenId,
        tableName: input.tableName,
        pk: input.pk,
        displayName: input.displayName,
        entityId: input.entityId,
        originalRecord,
        modifiedRecord,
        changedFields,
        userId: input.userId,
        branchId: input.branchId,
        notes: input.notes,
      },
      tx,
    );
  }

  private async resolveScreenId(
    input: LogEntityChangeInput,
    tx: AuditWriteClient,
  ): Promise<number> {
    if (input.screenId !== undefined) {
      if (!Number.isInteger(input.screenId) || input.screenId <= 0) {
        throw new BadRequestException('screenId must be a positive integer');
      }

      const existingScreen = await tx.auditScreen.findFirst({
        where: {
          screenId: input.screenId,
          screenStatus: true,
        },
        select: {
          screenId: true,
        },
      });

      if (!existingScreen) {
        throw new BadRequestException(`No active audit screen found with id ${input.screenId}`);
      }

      return existingScreen.screenId;
    }

    const screenName = input.screenName?.trim();
    if (!screenName) {
      throw new BadRequestException('Either screenId or screenName is required');
    }

    const existingScreen = await tx.auditScreen.findFirst({
      where: {
        screenName,
        screenStatus: true,
      },
      select: {
        screenId: true,
      },
      orderBy: {
        screenId: 'asc',
      },
    });

    if (existingScreen) {
      return existingScreen.screenId;
    }

    const createdScreen = await tx.auditScreen.create({
      data: {
        screenName,
        screenType: this.normalizeScreenType(input.screenType),
        screenStatus: true,
      },
      select: {
        screenId: true,
      },
    });

    return createdScreen.screenId;
  }

  private normalizeAction(action: string): AuditAction {
    const normalizedAction = action.trim().toLowerCase();
    switch (normalizedAction) {
      case 'new':
        return 'insert';
      case 'insert':
      case 'update':
      case 'approve':
      case 'cancel':
        return normalizedAction;
      default:
        throw new BadRequestException(`Unsupported audit action: ${action}`);
    }
  }

  private parseDateBoundary(value: string, boundary: 'start' | 'end'): Date {
    const normalized = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      const suffix = boundary === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
      return new Date(`${normalized}${suffix}`);
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid date value: ${value}`);
    }
    return parsed;
  }

  private toListItem(
    record: Prisma.AuditLogGetPayload<{
      include: { auditScreen: { select: { screenName: true } } };
    }>,
  ): AuditLogListItem {
    return {
      log_id: record.logId,
      log_date: record.logDate.toISOString(),
      log_action: record.logAction === 'insert' ? 'New' : record.logAction,
      log_screen_id: record.logScreenId,
      screen_name: record.auditScreen.screenName,
      log_table_name: record.logTableName,
      log_pk: record.logPk,
      log_display_name: record.logDisplayName,
      log_original_record: record.logOriginalRecord,
      log_modified_record: record.logModifiedRecord,
      log_changed_fields: record.logChangedFields,
      log_user_id: record.logUserId,
      log_branch_id: record.logBranchId,
      log_notes: record.logNotes,
    };
  }

  private normalizeScreenType(screenType?: string): AuditScreenType {
    const normalizedScreenType = screenType?.trim().toLowerCase();
    switch (normalizedScreenType) {
      case undefined:
      case '':
      case 'other':
        return 'other';
      case 'master':
        return 'master';
      case 'transaction':
        return 'transaction';
      case 'settings':
        return 'settings';
      default:
        throw new BadRequestException(`Unsupported audit screen type: ${screenType}`);
    }
  }

  private computeChangedFields(
    originalRecord: Prisma.JsonValue | null,
    modifiedRecord: Prisma.JsonValue | null,
  ): Prisma.JsonValue | null {
    const diff = this.computeJsonDiff(originalRecord, modifiedRecord);
    return diff ?? null;
  }

  private computeJsonDiff(
    left: Prisma.JsonValue | null,
    right: Prisma.JsonValue | null,
  ): Prisma.JsonValue | undefined {
    if (this.areJsonValuesEqual(left, right)) {
      return undefined;
    }

    if (this.isJsonObject(left) && this.isJsonObject(right)) {
      const diff: Prisma.JsonObject = {};
      const keys = new Set<string>([...Object.keys(left), ...Object.keys(right)]);
      for (const key of keys) {
        const hasLeft = Object.prototype.hasOwnProperty.call(left, key);
        const hasRight = Object.prototype.hasOwnProperty.call(right, key);
        const leftValue = hasLeft ? (left[key] as Prisma.JsonValue) : null;
        const rightValue = hasRight ? (right[key] as Prisma.JsonValue) : null;
        const childDiff = this.computeJsonDiff(leftValue, rightValue);
        if (childDiff !== undefined) {
          diff[key] = childDiff;
        }
      }

      return Object.keys(diff).length > 0 ? diff : undefined;
    }

    return {
      from: left ?? null,
      to: right ?? null,
    };
  }

  private areJsonValuesEqual(
    left: Prisma.JsonValue | null,
    right: Prisma.JsonValue | null,
  ): boolean {
    if (left === right) {
      return true;
    }

    if (left === null || right === null) {
      return false;
    }

    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) {
        return false;
      }
      for (let index = 0; index < left.length; index += 1) {
        if (!this.areJsonValuesEqual(left[index], right[index])) {
          return false;
        }
      }
      return true;
    }

    if (this.isJsonObject(left) && this.isJsonObject(right)) {
      const leftKeys = Object.keys(left);
      const rightKeys = Object.keys(right);
      if (leftKeys.length !== rightKeys.length) {
        return false;
      }
      for (const key of leftKeys) {
        if (!Object.prototype.hasOwnProperty.call(right, key)) {
          return false;
        }
        if (
          !this.areJsonValuesEqual(left[key] as Prisma.JsonValue, right[key] as Prisma.JsonValue)
        ) {
          return false;
        }
      }
      return true;
    }

    return false;
  }

  private isJsonObject(value: Prisma.JsonValue | null): value is Prisma.JsonObject {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private toJsonInput(
    value: unknown,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return Prisma.JsonNull;
    }

    return this.normalizeJsonValue(value) as Prisma.InputJsonValue;
  }

  private toNullableJson(value: unknown): Prisma.JsonValue | null {
    if (value === undefined || value === null) {
      return null;
    }

    return this.normalizeJsonValue(value);
  }

  private normalizeJsonValue(value: unknown): Prisma.JsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.JsonValue;
  }

  private normalizePk(value: string | number | bigint | null | undefined): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = String(value).trim();
    return normalized || null;
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }

  private normalizeUuid(value: string | number | null | undefined): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = String(value).trim();
    if (!normalized) {
      return null;
    }

    return UUID_PATTERN.test(normalized) ? normalized : null;
  }

  private resolveAuditUserId(providedUserId: string | number | null | undefined): string | null {
    const explicitUserId = this.normalizeUuid(providedUserId);
    if (explicitUserId) {
      return explicitUserId;
    }

    return this.normalizeUuid(this.requestContextService.getUserId());
  }

  private resolveAuditIpAddress(): string | null {
    const requestIpAddress = this.requestContextService.getIpAddress();
    return this.normalizeIpAddress(requestIpAddress);
  }

  private normalizeIpAddress(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    return isIP(normalized) === 0 ? null : normalized;
  }
}
