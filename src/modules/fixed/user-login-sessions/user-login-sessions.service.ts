import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { Prisma, UserLoginSession } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListUserLoginSessionsQueryDto } from './dto/list-user-login-sessions-query.dto';
import { SaveUserLoginSessionDto } from './dto/save-user-login-session.dto';
import {
  UserLoginSessionsErrorDetail,
  UserLoginSessionsErrorResponse,
  UserLoginSessionsListItem,
  UserLoginSessionsListMeta,
  UserLoginSessionsPayload,
} from './types/user-login-sessions-api.types';
const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const USER_LOGIN_SESSIONS_TABLE_NAME = 'user login sessions';
const USER_LOGIN_SESSIONS_AUDIT_SCREEN_NAME = 'User Login Sessions';
@Injectable()
export class UserLoginSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}
  async save(saveUserLoginSessionDto: SaveUserLoginSessionDto): Promise<UserLoginSessionsPayload> {
    if (saveUserLoginSessionDto.ulsId) {
      return this.updateSession(saveUserLoginSessionDto);
    }
    return this.createSession(saveUserLoginSessionDto);
  }
  async list(
    queryDto: ListUserLoginSessionsQueryDto,
  ): Promise<ConfiguredGridListResult<UserLoginSessionsListItem, UserLoginSessionsListMeta>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const hasStructuredFilters =
      queryDto.ulsCompanyId !== undefined ||
      queryDto.ulsBranchId !== undefined ||
      queryDto.ulsUserId !== undefined ||
      queryDto.ulsDeviceId !== undefined ||
      queryDto.ulsLoginStatus !== undefined ||
      queryDto.ulsIsActiveSession !== undefined ||
      queryDto.ulsIsActive !== undefined ||
      Boolean(queryDto.search?.trim());
    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }
    const where: Prisma.UserLoginSessionWhereInput = {
      ulsIsDeleted: false,
    };
    if (queryDto.ulsCompanyId !== undefined) {
      where.ulsCompanyId = queryDto.ulsCompanyId;
    }
    if (queryDto.ulsBranchId !== undefined) {
      where.ulsBranchId = queryDto.ulsBranchId;
    }
    if (queryDto.ulsUserId !== undefined) {
      where.ulsUserId = queryDto.ulsUserId;
    }
    if (queryDto.ulsDeviceId !== undefined) {
      where.ulsDeviceId = queryDto.ulsDeviceId;
    }
    if (queryDto.ulsLoginStatus?.trim()) {
      where.ulsLoginStatus = {
        equals: queryDto.ulsLoginStatus.trim(),
        mode: 'insensitive',
      };
    }
    if (queryDto.ulsIsActiveSession !== undefined) {
      where.ulsIsActiveSession = queryDto.ulsIsActiveSession;
    }
    if (queryDto.ulsIsActive !== undefined) {
      where.ulsIsActive = queryDto.ulsIsActive;
    }
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { ulsSessionToken: { contains: search, mode: 'insensitive' } },
        { ulsRefreshTokenId: { contains: search, mode: 'insensitive' } },
        { ulsLoginStatus: { contains: search, mode: 'insensitive' } },
        { ulsFailReason: { contains: search, mode: 'insensitive' } },
        { ulsIpAddress: { contains: search, mode: 'insensitive' } },
        { ulsUserAgent: { contains: search, mode: 'insensitive' } },
        { ulsAppVersion: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [total, records] = await Promise.all([
      this.prisma.userLoginSession.count({ where }),
      this.prisma.userLoginSession.findMany({
        where,
        orderBy: [{ ulsLoginOn: 'desc' }, { ulsId: 'desc' }],
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
  ): Promise<ConfiguredGridListResult<UserLoginSessionsListItem, UserLoginSessionsListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: USER_LOGIN_SESSIONS_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      USER_LOGIN_SESSIONS_TABLE_NAME,
    );
    const configuredGrid = primaryConfiguredGrids[0];
    if (!configuredGrid) {
      return null;
    }
    const rawGridSql = configuredGrid.gridSql?.trim();
    if (!rawGridSql) {
      return null;
    }
    const validation = this.configuredGridSqlService.validateBaseSql({
      sql: rawGridSql,
      tableName: USER_LOGIN_SESSIONS_TABLE_NAME,
    });
    if (!validation.isValid) {
      this.throwBadRequest('Invalid grid_sql configuration for user login sessions', [
        {
          field: 'grid_sql',
          message: validation.message,
        },
      ]);
    }
    try {
      const result = await this.configuredGridSqlService.runPagedQuery<UserLoginSessionsListItem>({
        baseSql: validation.normalizedSql,
        alias: 'user_login_sessions_grid',
        limit,
        skip,
          gridId: configuredGrid.gridId,
      });
      return {
        items: result.items,
        meta: {
          page,
          limit,
          total: result.total,
          total_pages: Math.ceil(result.total / limit),
        },
        styles: result.styles,
      };
    } catch {
      this.throwBadRequest('Invalid grid_sql configuration for user login sessions', [
        {
          field: 'grid_sql',
          message: 'Configured query could not be executed for user_login_sessions',
        },
      ]);
    }
  }
  async getById(ulsId: string): Promise<UserLoginSessionsPayload> {
    const record = await this.prisma.userLoginSession.findFirst({
      where: {
        ulsId,
        ulsIsDeleted: false,
      },
    });
    if (!record) {
      this.throwNotFound(ulsId);
    }
    return this.toPayload(record);
  }
  async softDelete(ulsId: string): Promise<{ ulsId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.userLoginSession.findFirst({
        where: {
          ulsId,
          ulsIsDeleted: false,
        },
      });
      if (!existing) {
        this.throwNotFound(ulsId);
      }
      const modifiedOn = new Date();
      const logoutOn = existing.ulsLogoutOn ?? modifiedOn;
      const result = await tx.userLoginSession.updateMany({
        where: {
          ulsId,
          ulsIsDeleted: false,
        },
        data: {
          ulsIsDeleted: true,
          ulsIsActive: false,
          ulsIsActiveSession: false,
          ulsLogoutOn: logoutOn,
          ulsModifiedOn: modifiedOn,
          ulsModifiedBy: DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        this.throwNotFound(ulsId);
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        ulsIsDeleted: true,
        ulsIsActive: false,
        ulsIsActiveSession: false,
        ulsLogoutOn: logoutOn,
        ulsModifiedOn: modifiedOn,
        ulsModifiedBy: DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: USER_LOGIN_SESSIONS_TABLE_NAME,
          screenName: USER_LOGIN_SESSIONS_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: ulsId,
          displayName: existing.ulsSessionId ?? existing.ulsId,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'User login session soft deleted',
        },
        tx,
      );
      return {
        ulsId,
        deleted: true,
      };
    });
  }
  private async createSession(
    saveUserLoginSessionDto: SaveUserLoginSessionDto,
  ): Promise<UserLoginSessionsPayload> {
    const now = new Date();
    const createdBy = this.resolveActor(saveUserLoginSessionDto.ulsCreatedBy);
    const modifiedBy = this.resolveActor(saveUserLoginSessionDto.ulsModifiedBy, createdBy);
    const data: Prisma.UserLoginSessionUncheckedCreateInput = {
      ulsCompanyId: saveUserLoginSessionDto.ulsCompanyId,
      ulsBranchId: saveUserLoginSessionDto.ulsBranchId,
      ulsUserId: saveUserLoginSessionDto.ulsUserId,
      ulsCreatedOn: now,
      ulsCreatedBy: createdBy,
      ulsModifiedOn: now,
      ulsModifiedBy: modifiedBy,
    };
    this.applyOptionalFields(data, saveUserLoginSessionDto);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.userLoginSession.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: USER_LOGIN_SESSIONS_TABLE_NAME,
            screenName: USER_LOGIN_SESSIONS_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.ulsId,
            displayName: payload.ulsSessionId ?? payload.ulsId,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'User login session created',
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
  private async updateSession(
    saveUserLoginSessionDto: SaveUserLoginSessionDto,
  ): Promise<UserLoginSessionsPayload> {
    const ulsId = saveUserLoginSessionDto.ulsId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.userLoginSession.findFirst({
          where: {
            ulsId,
            ulsIsDeleted: false,
          },
        });
        if (!existing) {
          this.throwNotFound(ulsId);
        }
        const data: Prisma.UserLoginSessionUncheckedUpdateInput = {
          ulsCompanyId: saveUserLoginSessionDto.ulsCompanyId,
          ulsBranchId: saveUserLoginSessionDto.ulsBranchId,
          ulsUserId: saveUserLoginSessionDto.ulsUserId,
          ulsModifiedOn: new Date(),
          ulsModifiedBy: this.resolveActor(saveUserLoginSessionDto.ulsModifiedBy),
        };
        this.applyOptionalFields(data, saveUserLoginSessionDto);
        const updated = await tx.userLoginSession.update({
          where: {
            ulsId,
          },
          data,
        });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: USER_LOGIN_SESSIONS_TABLE_NAME,
            screenName: USER_LOGIN_SESSIONS_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: ulsId,
            displayName: payload.ulsSessionId ?? payload.ulsId,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: this.resolveActor(saveUserLoginSessionDto.ulsModifiedBy),
            notes: 'User login session updated',
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
  private applyOptionalFields(
    data: Prisma.UserLoginSessionUncheckedCreateInput | Prisma.UserLoginSessionUncheckedUpdateInput,
    saveUserLoginSessionDto: SaveUserLoginSessionDto,
  ): void {
    if (this.hasOwnProperty(saveUserLoginSessionDto, 'ulsDeviceId')) {
      data.ulsDeviceId = saveUserLoginSessionDto.ulsDeviceId;
    }
    if (this.hasOwnProperty(saveUserLoginSessionDto, 'ulsSessionId')) {
      data.ulsSessionId = saveUserLoginSessionDto.ulsSessionId;
    }
    if (this.hasOwnProperty(saveUserLoginSessionDto, 'ulsSessionToken')) {
      data.ulsSessionToken = saveUserLoginSessionDto.ulsSessionToken;
    }
    if (this.hasOwnProperty(saveUserLoginSessionDto, 'ulsRefreshTokenId')) {
      data.ulsRefreshTokenId = saveUserLoginSessionDto.ulsRefreshTokenId;
    }
    if (this.hasOwnProperty(saveUserLoginSessionDto, 'ulsLoginOn')) {
      data.ulsLoginOn = saveUserLoginSessionDto.ulsLoginOn;
    }
    if (this.hasOwnProperty(saveUserLoginSessionDto, 'ulsLogoutOn')) {
      data.ulsLogoutOn = saveUserLoginSessionDto.ulsLogoutOn;
    }
    if (this.hasOwnProperty(saveUserLoginSessionDto, 'ulsLogoutType')) {
      data.ulsLogoutType = saveUserLoginSessionDto.ulsLogoutType;
    }
    if (this.hasOwnProperty(saveUserLoginSessionDto, 'ulsLoginStatus')) {
      data.ulsLoginStatus = saveUserLoginSessionDto.ulsLoginStatus;
    }
    if (this.hasOwnProperty(saveUserLoginSessionDto, 'ulsFailReason')) {
      data.ulsFailReason = saveUserLoginSessionDto.ulsFailReason;
    }
    if (this.hasOwnProperty(saveUserLoginSessionDto, 'ulsIpAddress')) {
      data.ulsIpAddress = saveUserLoginSessionDto.ulsIpAddress;
    }
    if (this.hasOwnProperty(saveUserLoginSessionDto, 'ulsUserAgent')) {
      data.ulsUserAgent = saveUserLoginSessionDto.ulsUserAgent;
    }
    if (this.hasOwnProperty(saveUserLoginSessionDto, 'ulsAppVersion')) {
      data.ulsAppVersion = saveUserLoginSessionDto.ulsAppVersion;
    }
    if (this.hasOwnProperty(saveUserLoginSessionDto, 'ulsIsActiveSession')) {
      data.ulsIsActiveSession = saveUserLoginSessionDto.ulsIsActiveSession;
    }
    if (this.hasOwnProperty(saveUserLoginSessionDto, 'ulsIsActive')) {
      data.ulsIsActive = saveUserLoginSessionDto.ulsIsActive;
    }
  }
  private toPayload(record: UserLoginSession): UserLoginSessionsPayload {
    return {
      ulsId: record.ulsId,
      ulsCompanyId: record.ulsCompanyId,
      ulsBranchId: record.ulsBranchId,
      ulsUserId: record.ulsUserId,
      ulsDeviceId: record.ulsDeviceId,
      ulsSessionId: record.ulsSessionId,
      ulsSessionToken: record.ulsSessionToken,
      ulsRefreshTokenId: record.ulsRefreshTokenId,
      ulsLoginOn: record.ulsLoginOn.toISOString(),
      ulsLogoutOn: record.ulsLogoutOn ? record.ulsLogoutOn.toISOString() : null,
      ulsLogoutType: record.ulsLogoutType,
      ulsLoginStatus: record.ulsLoginStatus,
      ulsFailReason: record.ulsFailReason,
      ulsIpAddress: record.ulsIpAddress,
      ulsUserAgent: record.ulsUserAgent,
      ulsAppVersion: record.ulsAppVersion,
      ulsIsActiveSession: record.ulsIsActiveSession,
      ulsIsActive: record.ulsIsActive,
      ulsIsDeleted: record.ulsIsDeleted,
      ulsSyncDate: record.ulsSyncDate ? record.ulsSyncDate.toISOString() : null,
      ulsCreatedOn: record.ulsCreatedOn.toISOString(),
      ulsCreatedBy: record.ulsCreatedBy,
      ulsModifiedOn: record.ulsModifiedOn.toISOString(),
      ulsModifiedBy: record.ulsModifiedBy,
    };
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
        this.buildErrorResponse('User login session already exists', [
          {
            field: 'ulsSessionId',
            message: 'Duplicate session is not allowed',
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
  private throwNotFound(ulsId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('User login session not found', [
        {
          field: 'ulsId',
          message: `No active user login session found with id ${ulsId}`,
        },
      ]),
    );
  }
  private throwBadRequest(message: string, errors: UserLoginSessionsErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }
  private buildErrorResponse(
    message: string,
    errors: UserLoginSessionsErrorDetail[] = [],
  ): UserLoginSessionsErrorResponse {
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
