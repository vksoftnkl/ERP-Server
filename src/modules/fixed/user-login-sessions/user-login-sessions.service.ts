import { Injectable } from '@nestjs/common';
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
import {
  DEFAULT_ACTOR,
  applyPresentFields,
  resolveActor,
  throwFixedNotFound,
  throwOnUniqueConstraintError,
} from 'src/common/utils/module-service.utils';
import { resolvePagination, runConfiguredGridQuery } from 'src/common/utils/module-list.utils';

const USER_LOGIN_SESSIONS_TABLE_NAME = 'user login sessions';
const USER_LOGIN_SESSIONS_AUDIT_SCREEN_NAME = 'User Login Sessions';
const USER_LOGIN_SESSION_OPTIONAL_FIELDS = [
  'ulsDeviceId',
  'ulsSessionId',
  'ulsSessionToken',
  'ulsRefreshTokenId',
  'ulsLoginOn',
  'ulsLogoutOn',
  'ulsLogoutType',
  'ulsLoginStatus',
  'ulsFailReason',
  'ulsIpAddress',
  'ulsUserAgent',
  'ulsAppVersion',
  'ulsIsActiveSession',
  'ulsIsActive',
];

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
    const { page, limit, skip } = resolvePagination(queryDto);
    const result = await runConfiguredGridQuery<UserLoginSessionsListItem>(
      this.configuredGridSqlService,
      { tableName: USER_LOGIN_SESSIONS_TABLE_NAME, alias: 'user_login_sessions_grid', search: queryDto.search, page, limit, skip },
    );
    if (!result) {
      throwFixedNotFound<UserLoginSessionsErrorDetail, UserLoginSessionsErrorResponse>('No configured grid found for user login sessions list', 'list', 'No configured grid found');
    }
    return result;
  }
  async getById(ulsId: string): Promise<UserLoginSessionsPayload> {
    const record = await this.prisma.userLoginSession.findFirst({
      where: { ulsId, ulsIsDeleted: false },
    });
    if (!record) {
      throwFixedNotFound<UserLoginSessionsErrorDetail, UserLoginSessionsErrorResponse>(
        'User login session not found',
        'ulsId',
        `No active user login session found with id ${ulsId}`,
      );
    }
    return this.toPayload(record);
  }

  async softDelete(ulsId: string): Promise<{ ulsId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.userLoginSession.findFirst({
        where: { ulsId, ulsIsDeleted: false },
      });
      if (!existing) {
        throwFixedNotFound<UserLoginSessionsErrorDetail, UserLoginSessionsErrorResponse>(
          'User login session not found',
          'ulsId',
          `No active user login session found with id ${ulsId}`,
        );
      }
      const modifiedOn = new Date();
      const logoutOn = existing.ulsLogoutOn ?? modifiedOn;
      const result = await tx.userLoginSession.updateMany({
        where: { ulsId, ulsIsDeleted: false },
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
        throwFixedNotFound<UserLoginSessionsErrorDetail, UserLoginSessionsErrorResponse>(
          'User login session not found',
          'ulsId',
          `No active user login session found with id ${ulsId}`,
        );
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
      return { ulsId, deleted: true };
    });
  }

  private async createSession(
    saveUserLoginSessionDto: SaveUserLoginSessionDto,
  ): Promise<UserLoginSessionsPayload> {
    const now = new Date();
    const createdBy = resolveActor(saveUserLoginSessionDto.ulsCreatedBy);
    const modifiedBy = resolveActor(saveUserLoginSessionDto.ulsModifiedBy, createdBy);
    const data: Prisma.UserLoginSessionUncheckedCreateInput = {
      ulsCompanyId: saveUserLoginSessionDto.ulsCompanyId,
      ulsBranchId: saveUserLoginSessionDto.ulsBranchId,
      ulsUserId: saveUserLoginSessionDto.ulsUserId,
      ulsCreatedOn: now,
      ulsCreatedBy: createdBy,
      ulsModifiedOn: now,
      ulsModifiedBy: modifiedBy,
    };
    applyPresentFields(data, saveUserLoginSessionDto, USER_LOGIN_SESSION_OPTIONAL_FIELDS);
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
      throwOnUniqueConstraintError<UserLoginSessionsErrorDetail, UserLoginSessionsErrorResponse>(
        error,
        'User login session already exists',
        [{ field: 'ulsSessionId', message: 'Duplicate session is not allowed' }],
      );
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
          where: { ulsId, ulsIsDeleted: false },
        });
        if (!existing) {
          throwFixedNotFound<UserLoginSessionsErrorDetail, UserLoginSessionsErrorResponse>(
            'User login session not found',
            'ulsId',
            `No active user login session found with id ${ulsId}`,
          );
        }
        const data: Prisma.UserLoginSessionUncheckedUpdateInput = {
          ulsCompanyId: saveUserLoginSessionDto.ulsCompanyId,
          ulsBranchId: saveUserLoginSessionDto.ulsBranchId,
          ulsUserId: saveUserLoginSessionDto.ulsUserId,
          ulsModifiedOn: new Date(),
          ulsModifiedBy: resolveActor(saveUserLoginSessionDto.ulsModifiedBy),
        };
        applyPresentFields(data, saveUserLoginSessionDto, USER_LOGIN_SESSION_OPTIONAL_FIELDS);
        const updated = await tx.userLoginSession.update({ where: { ulsId }, data });
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
            userId: resolveActor(saveUserLoginSessionDto.ulsModifiedBy),
            notes: 'User login session updated',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<UserLoginSessionsErrorDetail, UserLoginSessionsErrorResponse>(
        error,
        'User login session already exists',
        [{ field: 'ulsSessionId', message: 'Duplicate session is not allowed' }],
      );
      throw error;
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
}
