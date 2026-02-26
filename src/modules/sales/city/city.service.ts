import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CityMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListCityQueryDto } from './dto/list-city-query.dto';
import { SaveCityDto } from './dto/save-city.dto';
import {
  CityErrorDetail,
  CityErrorResponse,
  CityListItem,
  CityListMeta,
  CityPayload,
} from './types/city-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const CITY_TABLE_NAME = 'city_master';
const CITY_AUDIT_SCREEN_NAME = 'City Master';
const GRID_SQL_FORBIDDEN_TOKENS =
  /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke)\b/i;
const GRID_SQL_COMMENT_PATTERN = /(--|\/\*)/;

type CityWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class CityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async save(saveCityDto: SaveCityDto): Promise<CityPayload> {
    if (saveCityDto.ctmId) {
      return this.updateCity(saveCityDto);
    }

    return this.createCity(saveCityDto);
  }

  async list(queryDto: ListCityQueryDto): Promise<{ items: CityListItem[]; meta: CityListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const hasStructuredFilters =
      queryDto.ctmStateId !== undefined ||
      queryDto.ctmIsActive !== undefined ||
      Boolean(queryDto.search?.trim());

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where: Prisma.CityMasterWhereInput = {
      ctmIsDeleted: false,
    };

    if (queryDto.ctmStateId !== undefined) {
      where.ctmStateId = queryDto.ctmStateId;
    }

    if (queryDto.ctmIsActive !== undefined) {
      where.ctmIsActive = queryDto.ctmIsActive;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { ctmName: { contains: search, mode: 'insensitive' } },
        { ctmAlias: { contains: search, mode: 'insensitive' } },
        { ctmShort: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.cityMaster.count({ where }),
      this.prisma.cityMaster.findMany({
        where,
        orderBy: [{ ctmName: 'asc' }, { ctmId: 'asc' }],
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

  private async listFromConfiguredGridSql(
    page: number,
    limit: number,
    skip: number,
  ): Promise<{ items: CityListItem[]; meta: CityListMeta } | null> {
    const configuredGrids = await this.prisma.gridDetails.findMany({
      where: {
        gridIsDeleted: false,
        gridStatus: true,
        gridSql: {
          not: null,
          contains: CITY_TABLE_NAME,
          mode: 'insensitive',
        },
      },
      orderBy: [{ gridSortOrder: 'asc' }, { gridId: 'desc' }],
      select: {
        gridSql: true,
      },
    });
    if (configuredGrids.length === 0) {
      return null;
    }

    const preferredConfiguredGrids = configuredGrids.filter((configuredGrid) =>
      this.referencesCityAsPrimaryFromTable(configuredGrid.gridSql),
    );
    const candidateConfiguredGrids =
      preferredConfiguredGrids.length > 0 ? preferredConfiguredGrids : configuredGrids;

    for (const configuredGrid of candidateConfiguredGrids) {
      const rawGridSql = configuredGrid.gridSql?.trim();
      if (!rawGridSql) {
        continue;
      }

      try {
        const baseSql = this.validateConfiguredGridSql(rawGridSql);
        const countSql = `SELECT COUNT(*)::bigint AS total FROM (${baseSql}) AS city_grid`;
        const rowsSql = `SELECT * FROM (${baseSql}) AS city_grid LIMIT $1 OFFSET $2`;
        const [countResult, rows] = await Promise.all([
          this.prisma.$queryRawUnsafe<Array<{ total: bigint | number | string }>>(countSql),
          this.prisma.$queryRawUnsafe<CityListItem[]>(rowsSql, limit, skip),
        ]);
        const total = this.parseCountValue(countResult[0]?.total);

        return {
          items: rows,
          meta: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
          },
        };
      } catch {
        continue;
      }
    }

    return null;
  }

  private referencesCityAsPrimaryFromTable(sql: string | null): boolean {
    if (!sql) {
      return false;
    }

    return this.extractTopLevelFromTableName(sql) === CITY_TABLE_NAME;
  }

  private extractTopLevelFromTableName(sql: string): string | null {
    const trimmed = sql.trim();
    const selectMatch = trimmed.match(/^select\b/i);
    if (!selectMatch) {
      return null;
    }

    const selectStartIndex = selectMatch[0].length;
    let depth = 0;
    let insideSingleQuote = false;
    let insideDoubleQuote = false;

    for (let index = selectStartIndex; index < trimmed.length; index += 1) {
      const current = trimmed[index];
      const next = trimmed[index + 1];

      if (insideSingleQuote) {
        if (current === "'" && next === "'") {
          index += 1;
          continue;
        }
        if (current === "'") {
          insideSingleQuote = false;
        }
        continue;
      }

      if (insideDoubleQuote) {
        if (current === '"' && next === '"') {
          index += 1;
          continue;
        }
        if (current === '"') {
          insideDoubleQuote = false;
        }
        continue;
      }

      if (current === "'") {
        insideSingleQuote = true;
        continue;
      }
      if (current === '"') {
        insideDoubleQuote = true;
        continue;
      }
      if (current === '(') {
        depth += 1;
        continue;
      }
      if (current === ')') {
        depth = Math.max(0, depth - 1);
        continue;
      }

      if (
        depth === 0 &&
        /^from$/i.test(trimmed.slice(index, index + 4)) &&
        (index === 0 || /\s/.test(trimmed[index - 1])) &&
        (index + 4 >= trimmed.length || /\s/.test(trimmed[index + 4]))
      ) {
        const fromClause = trimmed.slice(index + 4).trimStart();
        const identifierPattern = '(?:"(?:""|[^"])+"|[a-z_][a-z0-9_$]*)';
        const relationPattern = new RegExp(
          `^(?:${identifierPattern}\\s*\\.\\s*)?(${identifierPattern})`,
          'i',
        );
        const relationMatch = fromClause.match(relationPattern);
        if (!relationMatch) {
          return null;
        }
        return this.parseSqlIdentifierToken(relationMatch[1]);
      }
    }

    return null;
  }

  private parseSqlIdentifierToken(token: string): string | null {
    const trimmed = token.trim();
    if (!trimmed) {
      return null;
    }

    if (/^"([^"]|"")+"$/.test(trimmed)) {
      return trimmed.slice(1, -1).replace(/""/g, '"');
    }

    if (/^[a-z_][a-z0-9_$]*$/i.test(trimmed)) {
      return trimmed.toLowerCase();
    }

    return null;
  }

  private validateConfiguredGridSql(sql: string): string {
    const normalized = sql.trim().replace(/;+\s*$/g, '');
    if (!/^select\b/i.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for city list', [
        {
          field: 'grid_sql',
          message: 'Only SELECT query is allowed',
        },
      ]);
    }

    if (normalized.includes(';')) {
      this.throwBadRequest('Invalid grid_sql configuration for city list', [
        {
          field: 'grid_sql',
          message: 'Multiple statements are not allowed',
        },
      ]);
    }

    if (GRID_SQL_COMMENT_PATTERN.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for city list', [
        {
          field: 'grid_sql',
          message: 'Comments are not allowed in configured query',
        },
      ]);
    }

    if (GRID_SQL_FORBIDDEN_TOKENS.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for city list', [
        {
          field: 'grid_sql',
          message: 'Write/DDL statements are not allowed',
        },
      ]);
    }

    if (!/\bcity_master\b/i.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for city list', [
        {
          field: 'grid_sql',
          message: 'Configured query must reference city_master table',
        },
      ]);
    }

    return normalized;
  }

  private parseCountValue(value: bigint | number | string | undefined): number {
    if (typeof value === 'bigint') {
      return Number(value);
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  async getById(ctmId: string): Promise<CityPayload> {
    const record = await this.prisma.cityMaster.findFirst({
      where: {
        ctmId,
        ctmIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(ctmId);
    }

    return this.toPayload(record);
  }

  async softDelete(ctmId: string): Promise<{ ctmId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.cityMaster.findFirst({
        where: {
          ctmId,
          ctmIsDeleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound(ctmId);
      }

      const areaCount = await tx.areaMaster.count({
        where: {
          armCityId: ctmId,
          armIsDeleted: false,
        },
      });

      if (areaCount > 0) {
        this.throwBadRequest('Cannot delete city with active areas', [
          {
            field: 'ctmId',
            message: `City ${ctmId} is used by ${areaCount} area(s).`,
          },
        ]);
      }

      const modifiedOn = new Date();
      const result = await tx.cityMaster.updateMany({
        where: {
          ctmId,
          ctmIsDeleted: false,
        },
        data: {
          ctmIsDeleted: true,
          ctmIsActive: false,
          ctmModifiedOn: modifiedOn,
          ctmModifiedBy: DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        this.throwNotFound(ctmId);
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        ctmIsDeleted: true,
        ctmIsActive: false,
        ctmModifiedOn: modifiedOn,
        ctmModifiedBy: DEFAULT_ACTOR,
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: CITY_TABLE_NAME,
          screenName: CITY_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: ctmId,
          displayName: existing.ctmName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'City soft deleted',
        },
        tx,
      );

      return {
        ctmId,
        deleted: true,
      };
    });
  }

  private async createCity(saveCityDto: SaveCityDto): Promise<CityPayload> {
    const normalizedName = this.normalizeRequiredName(saveCityDto.ctmName);
    const now = new Date();
    const createdBy = this.resolveActor(saveCityDto.ctmCreatedBy);
    const modifiedBy = this.resolveActor(saveCityDto.ctmModifiedBy, createdBy);
    const data: Prisma.CityMasterUncheckedCreateInput = {
      ctmName: normalizedName,
      ctmStateId: saveCityDto.ctmStateId,
      ctmCreatedOn: now,
      ctmCreatedBy: createdBy,
      ctmModifiedOn: now,
      ctmModifiedBy: modifiedBy,
    };
    this.applyOptionalFields(data, saveCityDto);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureStateExists(tx, data.ctmStateId);
        await this.ensureNameIsUnique(tx, normalizedName, data.ctmStateId);

        const created = await tx.cityMaster.create({ data });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: CITY_TABLE_NAME,
            screenName: CITY_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.ctmId,
            displayName: payload.ctmName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'City created',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  private async updateCity(saveCityDto: SaveCityDto): Promise<CityPayload> {
    const ctmId = saveCityDto.ctmId!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.cityMaster.findFirst({
          where: {
            ctmId,
            ctmIsDeleted: false,
          },
        });

        if (!existing) {
          this.throwNotFound(ctmId);
        }

        const normalizedName = this.normalizeRequiredName(saveCityDto.ctmName);
        const nextStateId = this.hasOwnProperty(saveCityDto, 'ctmStateId')
          ? saveCityDto.ctmStateId
          : existing.ctmStateId;

        await this.ensureStateExists(tx, nextStateId);
        await this.ensureNameIsUnique(tx, normalizedName, nextStateId, ctmId);

        const data: Prisma.CityMasterUncheckedUpdateInput = {
          ctmName: normalizedName,
          ctmStateId: nextStateId,
          ctmModifiedOn: new Date(),
          ctmModifiedBy: this.resolveActor(saveCityDto.ctmModifiedBy),
        };
        this.applyOptionalFields(data, saveCityDto);

        const updated = await tx.cityMaster.update({
          where: {
            ctmId,
          },
          data,
        });
        const payload = this.toPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: CITY_TABLE_NAME,
            screenName: CITY_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: ctmId,
            displayName: payload.ctmName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.ctmModifiedBy,
            notes: 'City updated',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  private async ensureStateExists(tx: CityWriteClient, stateId: string): Promise<void> {
    const state = await tx.stateMaster.findFirst({
      where: {
        stmId: stateId,
        stmIsDeleted: false,
      },
      select: {
        stmId: true,
      },
    });

    if (!state) {
      this.throwBadRequest('State does not exist', [
        {
          field: 'ctmStateId',
          message: `No active state found with id ${stateId}`,
        },
      ]);
    }
  }

  private async ensureNameIsUnique(
    tx: CityWriteClient,
    cityName: string,
    stateId: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await tx.cityMaster.findFirst({
      where: {
        ctmIsDeleted: false,
        ctmStateId: stateId,
        ctmName: {
          equals: cityName,
          mode: 'insensitive',
        },
        ...(excludeId
          ? {
              ctmId: {
                not: excludeId,
              },
            }
          : {}),
      },
      select: {
        ctmId: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        this.buildErrorResponse('City name already exists for this state', [
          {
            field: 'ctmName',
            message: 'Duplicate city name is not allowed for this state',
          },
        ]),
      );
    }
  }

  private applyOptionalFields(
    data: Prisma.CityMasterUncheckedCreateInput | Prisma.CityMasterUncheckedUpdateInput,
    saveCityDto: SaveCityDto,
  ): void {
    if (this.hasOwnProperty(saveCityDto, 'ctmAlias')) {
      data.ctmAlias = saveCityDto.ctmAlias;
    }

    if (this.hasOwnProperty(saveCityDto, 'ctmShort')) {
      data.ctmShort = saveCityDto.ctmShort;
    }

    if (this.hasOwnProperty(saveCityDto, 'ctmOrder')) {
      data.ctmOrder = saveCityDto.ctmOrder;
    }

    if (this.hasOwnProperty(saveCityDto, 'ctmIsActive')) {
      data.ctmIsActive = saveCityDto.ctmIsActive;
    }
  }

  private normalizeRequiredName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'ctmName',
          message: 'ctmName must not be empty',
        },
      ]);
    }

    return trimmed;
  }

  private toPayload(record: CityMaster): CityPayload {
    return {
      ctmId: record.ctmId,
      ctmName: record.ctmName,
      ctmAlias: record.ctmAlias,
      ctmShort: record.ctmShort,
      ctmStateId: record.ctmStateId,
      ctmOrder: this.toNumber(record.ctmOrder),
      ctmIsActive: record.ctmIsActive,
      ctmIsDeleted: record.ctmIsDeleted,
      ctmSyncDate: record.ctmSyncDate ? record.ctmSyncDate.toISOString() : null,
      ctmCreatedOn: record.ctmCreatedOn.toISOString(),
      ctmCreatedBy: record.ctmCreatedBy,
      ctmModifiedOn: record.ctmModifiedOn.toISOString(),
      ctmModifiedBy: record.ctmModifiedBy,
    };
  }

  private toNumber(value: Prisma.Decimal | number): number {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value.toString());
  }

  private resolveActor(value: string | null | undefined, fallback = DEFAULT_ACTOR): string {
    if (!value) {
      return fallback;
    }

    const trimmed = value.trim();
    return trimmed || fallback;
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('City already exists', [
          {
            field: 'ctmName',
            message: 'Duplicate ctmName is not allowed',
          },
        ]),
      );
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    return (error as { code?: string }).code === 'P2002';
  }

  private throwNotFound(ctmId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('City not found', [
        {
          field: 'ctmId',
          message: `No active city found with id ${ctmId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: CityErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(message: string, errors: CityErrorDetail[] = []): CityErrorResponse {
    return {
      success: false,
      message,
      errors,
    };
  }

  private hasOwnProperty<T extends object>(obj: T, key: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }
}
