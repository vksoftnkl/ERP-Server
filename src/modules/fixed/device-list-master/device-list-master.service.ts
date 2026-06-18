import { Injectable } from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { DeviceMaster, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListDeviceListMasterQueryDto } from './dto/list-device-list-master-query.dto';
import { SaveDeviceListMasterDto } from './dto/save-device-list-master.dto';
import {
  DeviceListMasterErrorDetail,
  DeviceListMasterErrorResponse,
  DeviceListMasterListItem,
  DeviceListMasterListMeta,
  DeviceListMasterPayload,
} from './types/device-list-master-api.types';
import { DevicePlatform, DeviceType } from './types/device-list-master-enum';
import {
  DEFAULT_ACTOR,
  FixedWriteClient,
  applyPresentFields,
  hasOwnProperty,
  normalizeRequiredText,
  resolveActor,
  throwFixedBadRequest,
  throwFixedConflict,
  throwFixedNotFound,
  throwOnUniqueConstraintError,
} from 'src/common/utils/module-service.utils';
import { resolvePagination, runConfiguredGridQuery } from 'src/common/utils/module-list.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
const DEVICE_LIST_MASTER_TABLE_NAME = 'erp device master';
const DEVICE_LIST_MASTER_AUDIT_SCREEN_NAME = 'Device List Master';
const DEVICE_TYPE_VALUES = Object.values(DeviceType);
const DEVICE_PLATFORM_VALUES = Object.values(DevicePlatform);
const DEVICE_LIST_MASTER_OPTIONAL_FIELDS = [
  'devCompanyId',
  'devBranchId',
  'devUserId',
  'devDeviceName',
  'devDeviceType',
  'devPlatform',
  'devMacAddress',
  'devIsBlocked',
  'devBlockReason',
  'devLastIp',
  'devIsActive',
];
const DEVICE_LIST_MASTER_OPTIONAL_FIELD_TRANSFORMS = {
  devDeviceType: normalizeDeviceType,
  devPlatform: normalizeDevicePlatform,
};
function isDeviceUidRequired(deviceType: DeviceType): boolean {
  return deviceType === DeviceType.DESKTOP;
}
function normalizeDeviceType(value: unknown): DeviceType | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throwFixedBadRequest<DeviceListMasterErrorDetail, DeviceListMasterErrorResponse>(
      'Validation failed',
      [{ field: 'devDeviceType', message: 'devDeviceType must be a string' }],
    );
  }
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  if (!DEVICE_TYPE_VALUES.includes(normalized as DeviceType)) {
    throwFixedBadRequest<DeviceListMasterErrorDetail, DeviceListMasterErrorResponse>(
      'Validation failed',
      [
        {
          field: 'devDeviceType',
          message: `devDeviceType must be one of: ${DEVICE_TYPE_VALUES.join(', ')}`,
        },
      ],
    );
  }
  return normalized as DeviceType;
}
function buildGeneratedDeviceUid(deviceType: DeviceType): string {
  return `${deviceType.toUpperCase()}-${randomUUID()}`;
}
function normalizeDeviceUid(value: string | undefined, deviceType: DeviceType): string | undefined {
  if (isDeviceUidRequired(deviceType)) {
    return normalizeRequiredText<DeviceListMasterErrorDetail, DeviceListMasterErrorResponse>(
      value ?? '',
      'devDeviceUid',
      'devDeviceUid is required when devDeviceType is Desktop',
    );
  }
  const trimmed = value?.trim();
  return trimmed || undefined;
}
function normalizeDevicePlatform(value: unknown): DevicePlatform | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throwFixedBadRequest<DeviceListMasterErrorDetail, DeviceListMasterErrorResponse>(
      'Validation failed',
      [{ field: 'devPlatform', message: 'devPlatform must be a string' }],
    );
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (!DEVICE_PLATFORM_VALUES.includes(normalized as DevicePlatform)) {
    throwFixedBadRequest<DeviceListMasterErrorDetail, DeviceListMasterErrorResponse>(
      'Validation failed',
      [
        {
          field: 'devPlatform',
          message: `devPlatform must be one of: ${DEVICE_PLATFORM_VALUES.join(', ')}`,
        },
      ],
    );
  }
  return normalized as DevicePlatform;
}
function toDeviceType(value: string): DeviceType {
  return value as DeviceType;
}
function toDevicePlatform(value: string | null): DevicePlatform | null {
  return value === null ? null : (value as DevicePlatform);
}
@Injectable()
export class DeviceListMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(saveDeviceListMasterDto: SaveDeviceListMasterDto): Promise<DeviceListMasterPayload> {
    if (saveDeviceListMasterDto.devId) {
      return this.updateDevice(saveDeviceListMasterDto);
    }
    return this.createDevice(saveDeviceListMasterDto);
  }
  async list(
    queryDto: ListDeviceListMasterQueryDto,
  ): Promise<ConfiguredGridListResult<DeviceListMasterListItem, DeviceListMasterListMeta>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const result = await runConfiguredGridQuery<DeviceListMasterListItem>(
      this.configuredGridSqlService,
      { tableName: DEVICE_LIST_MASTER_TABLE_NAME, alias: 'device_list_master_grid', search: queryDto.search, page, limit, skip },
    );
    if (!result) {
      throwFixedBadRequest<DeviceListMasterErrorDetail, DeviceListMasterErrorResponse>('No configured grid found for device list master', []);
    }
    return result;
  }
  async getById(devId: string): Promise<DeviceListMasterPayload> {
    const record = await this.prisma.deviceMaster.findFirst({
      where: { devId, devIsDeleted: false },
    });
    if (!record) {
      throwFixedNotFound<DeviceListMasterErrorDetail, DeviceListMasterErrorResponse>(
        'Device not found',
        'devId',
        `No active device found with id ${devId}`,
      );
    }
    return this.toPayload(record);
  }
  async softDelete(devId: string): Promise<{ devId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.deviceMaster.findFirst({
        where: { devId, devIsDeleted: false },
      });
      if (!existing) {
        throwFixedNotFound<DeviceListMasterErrorDetail, DeviceListMasterErrorResponse>(
          'Device not found',
          'devId',
          `No active device found with id ${devId}`,
        );
      }
      const sessionCount = await tx.userLoginSession.count({
        where: { ulsDeviceId: devId, ulsIsDeleted: false },
      });
      if (sessionCount > 0) {
        throwFixedBadRequest<DeviceListMasterErrorDetail, DeviceListMasterErrorResponse>(
          'Cannot delete device with active login sessions',
          [{ field: 'devId', message: `Device ${devId} is used in ${sessionCount} login session(s).` }],
        );
      }
      const modifiedOn = new Date();
      const result = await tx.deviceMaster.updateMany({
        where: { devId, devIsDeleted: false },
        data: {
          devIsDeleted: true,
          devIsActive: false,
          devModifiedOn: modifiedOn,
          devModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        throwFixedNotFound<DeviceListMasterErrorDetail, DeviceListMasterErrorResponse>(
          'Device not found',
          'devId',
          `No active device found with id ${devId}`,
        );
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        devIsDeleted: true,
        devIsActive: false,
        devModifiedOn: modifiedOn,
        devModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: DEVICE_LIST_MASTER_TABLE_NAME,
          screenName: DEVICE_LIST_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: devId,
          displayName: existing.devDeviceUid,
          originalRecord,
          modifiedRecord,
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
          notes: 'Device soft deleted',
        },
        tx,
      );
      return { devId, deleted: true };
    });
  }
  private async createDevice(
    saveDeviceListMasterDto: SaveDeviceListMasterDto,
  ): Promise<DeviceListMasterPayload> {
    const normalizedDeviceType = normalizeDeviceType(saveDeviceListMasterDto.devDeviceType) ?? DeviceType.DESKTOP;
    const normalizedDeviceUid =
      normalizeDeviceUid(saveDeviceListMasterDto.devDeviceUid, normalizedDeviceType) ??
      buildGeneratedDeviceUid(normalizedDeviceType);
    const companyId = hasOwnProperty(saveDeviceListMasterDto, 'devCompanyId')
      ? (saveDeviceListMasterDto.devCompanyId ?? null)
      : null;
    const now = new Date();
    const createdBy = resolveActor(saveDeviceListMasterDto.devEntryBy, this.requestContextService.getUserId() ?? DEFAULT_ACTOR);
    const data: Prisma.DeviceMasterUncheckedCreateInput = {
      devDeviceUid: normalizedDeviceUid,
      devCreatedOn: now,
      devCreatedBy: createdBy,
      devModifiedOn: null,
      devModifiedBy: null,
    };
    applyPresentFields(
      data,
      saveDeviceListMasterDto,
      DEVICE_LIST_MASTER_OPTIONAL_FIELDS,
      DEVICE_LIST_MASTER_OPTIONAL_FIELD_TRANSFORMS,
    );
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureDeviceUidIsUnique(tx, normalizedDeviceUid, companyId);
        const created = await tx.deviceMaster.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: DEVICE_LIST_MASTER_TABLE_NAME,
            screenName: DEVICE_LIST_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.devId,
            displayName: payload.devDeviceUid,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Device created',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<DeviceListMasterErrorDetail, DeviceListMasterErrorResponse>(
        error,
        'Device already exists',
        [{ field: 'devDeviceUid', message: 'Duplicate devDeviceUid is not allowed' }],
      );
      throw error;
    }
  }
  private async updateDevice(
    saveDeviceListMasterDto: SaveDeviceListMasterDto,
  ): Promise<DeviceListMasterPayload> {
    const devId = saveDeviceListMasterDto.devId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.deviceMaster.findFirst({
          where: { devId, devIsDeleted: false },
        });
        if (!existing) {
          throwFixedNotFound<DeviceListMasterErrorDetail, DeviceListMasterErrorResponse>(
            'Device not found',
            'devId',
            `No active device found with id ${devId}`,
          );
        }
        const normalizedDeviceType = normalizeDeviceType(saveDeviceListMasterDto.devDeviceType) ?? toDeviceType(existing.devDeviceType);
        const normalizedDeviceUid = normalizeDeviceUid(saveDeviceListMasterDto.devDeviceUid, normalizedDeviceType);
        const nextDeviceUid = normalizedDeviceUid ?? existing.devDeviceUid;
        const nextCompanyId = hasOwnProperty(saveDeviceListMasterDto, 'devCompanyId')
          ? (saveDeviceListMasterDto.devCompanyId ?? null)
          : existing.devCompanyId;
        await this.ensureDeviceUidIsUnique(tx, nextDeviceUid, nextCompanyId, devId);
        const data: Prisma.DeviceMasterUncheckedUpdateInput = {
          devModifiedOn: new Date(),
          devModifiedBy: resolveActor(saveDeviceListMasterDto.devEntryBy, this.requestContextService.getUserId() ?? DEFAULT_ACTOR),
        };
        if (normalizedDeviceUid !== undefined) {
          data.devDeviceUid = normalizedDeviceUid;
        }
        applyPresentFields(
          data,
          saveDeviceListMasterDto,
          DEVICE_LIST_MASTER_OPTIONAL_FIELDS,
          DEVICE_LIST_MASTER_OPTIONAL_FIELD_TRANSFORMS,
        );
        const updated = await tx.deviceMaster.update({ where: { devId }, data });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: DEVICE_LIST_MASTER_TABLE_NAME,
            screenName: DEVICE_LIST_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: devId,
            displayName: payload.devDeviceUid,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: resolveActor(saveDeviceListMasterDto.devEntryBy, this.requestContextService.getUserId() ?? DEFAULT_ACTOR),
            notes: 'Device updated',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<DeviceListMasterErrorDetail, DeviceListMasterErrorResponse>(
        error,
        'Device already exists',
        [{ field: 'devDeviceUid', message: 'Duplicate devDeviceUid is not allowed' }],
      );
      throw error;
    }
  }
  private async ensureDeviceUidIsUnique(
    tx: FixedWriteClient,
    deviceUid: string,
    companyId: string | null,
    excludeId?: string,
  ): Promise<void> {
    const existing = await tx.deviceMaster.findFirst({
      where: {
        devIsDeleted: false,
        devCompanyId: companyId,
        devDeviceUid: { equals: deviceUid, mode: 'insensitive' },
        ...(excludeId ? { devId: { not: excludeId } } : {}),
      },
      select: { devId: true },
    });
    if (existing) {
      throwFixedConflict<DeviceListMasterErrorDetail, DeviceListMasterErrorResponse>(
        'Device UID already exists',
        [{ field: 'devDeviceUid', message: 'Duplicate devDeviceUid is not allowed' }],
      );
    }
  }
  private toPayload(record: DeviceMaster): DeviceListMasterPayload {
    return {
      devId: record.devId,
      devCompanyId: record.devCompanyId,
      devBranchId: record.devBranchId,
      devUserId: record.devUserId,
      devDeviceUid: record.devDeviceUid,
      devDeviceName: record.devDeviceName,
      devDeviceType: toDeviceType(record.devDeviceType),
      devPlatform: toDevicePlatform(record.devPlatform),
      devMacAddress: record.devMacAddress,
      devIsBlocked: record.devIsBlocked,
      devBlockReason: record.devBlockReason,
      devLastIp: record.devLastIp,
      devIsActive: record.devIsActive,
      devIsDeleted: record.devIsDeleted,
      devSyncDate: record.devSyncDate ? record.devSyncDate.toISOString() : null,
      devCreatedOn: record.devCreatedOn.toISOString(),
      devCreatedBy: record.devCreatedBy,
      devModifiedOn: record.devModifiedOn ? record.devModifiedOn.toISOString() : null,
      devModifiedBy: record.devModifiedBy,
    };
  }
}