import { Injectable } from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { DeviceMaster, Prisma } from '@prisma/client';
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
import { resolvePagination, runConfiguredGridQuery, runFixedListQuery } from 'src/common/utils/module-list.utils';

const DEVICE_LIST_MASTER_TABLE_NAME = 'erp device master';
const DEVICE_LIST_MASTER_AUDIT_SCREEN_NAME = 'Device List Master';
const DEVICE_LIST_MASTER_OPTIONAL_FIELDS = [
  'devCompanyId',
  'devBranchId',
  'devUserId',
  'devDeviceName',
  'devPlatform',
  'devMacAddress',
  'devIsBlocked',
  'devBlockReason',
  'devLastIp',
  'devIsActive',
];

@Injectable()
export class DeviceListMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
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
    const hasStructuredFilters =
      queryDto.devCompanyId !== undefined ||
      queryDto.devIsActive !== undefined ||
      queryDto.devIsBlocked !== undefined;
    const where: Prisma.DeviceMasterWhereInput = { devIsDeleted: false };
    if (queryDto.devCompanyId !== undefined) where.devCompanyId = queryDto.devCompanyId;
    if (queryDto.devIsActive !== undefined) where.devIsActive = queryDto.devIsActive;
    if (queryDto.devIsBlocked !== undefined) where.devIsBlocked = queryDto.devIsBlocked;
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { devDeviceUid: { contains: search, mode: 'insensitive' } },
        { devDeviceName: { contains: search, mode: 'insensitive' } },
        { devDeviceType: { contains: search, mode: 'insensitive' } },
        { devPlatform: { contains: search, mode: 'insensitive' } },
        { devMacAddress: { contains: search, mode: 'insensitive' } },
        { devLastIp: { contains: search, mode: 'insensitive' } },
      ];
    }
    return runFixedListQuery({ page, limit }, {
      hasStructuredFilters,
      configuredGridFn: () => runConfiguredGridQuery<DeviceListMasterListItem>(
        this.configuredGridSqlService,
        { tableName: DEVICE_LIST_MASTER_TABLE_NAME, alias: 'device_list_master_grid', search: queryDto.search, page, limit, skip },
      ),
      countFn: () => this.prisma.deviceMaster.count({ where }),
      findManyFn: () => this.prisma.deviceMaster.findMany({
        where,
        orderBy: [{ devCreatedOn: 'desc' }, { devId: 'desc' }],
        skip,
        take: limit,
      }),
      toItemFn: (record) => this.toPayload(record as DeviceMaster),
    });
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
          devModifiedBy: DEFAULT_ACTOR,
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
        devModifiedBy: DEFAULT_ACTOR,
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
          userId: DEFAULT_ACTOR,
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
    const normalizedDeviceUid = normalizeRequiredText<DeviceListMasterErrorDetail, DeviceListMasterErrorResponse>(
      saveDeviceListMasterDto.devDeviceUid,
      'devDeviceUid',
    );
    const normalizedDeviceType = normalizeRequiredText<DeviceListMasterErrorDetail, DeviceListMasterErrorResponse>(
      saveDeviceListMasterDto.devDeviceType,
      'devDeviceType',
    );
    const companyId = hasOwnProperty(saveDeviceListMasterDto, 'devCompanyId')
      ? (saveDeviceListMasterDto.devCompanyId ?? null)
      : null;
    const now = new Date();
    const createdBy = resolveActor(saveDeviceListMasterDto.devCreatedBy);
    const modifiedBy = resolveActor(saveDeviceListMasterDto.devModifiedBy, createdBy);
    const data: Prisma.DeviceMasterUncheckedCreateInput = {
      devDeviceUid: normalizedDeviceUid,
      devDeviceType: normalizedDeviceType,
      devCreatedOn: now,
      devCreatedBy: createdBy,
      devModifiedOn: now,
      devModifiedBy: modifiedBy,
    };
    applyPresentFields(data, saveDeviceListMasterDto, DEVICE_LIST_MASTER_OPTIONAL_FIELDS);
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
        const normalizedDeviceUid = normalizeRequiredText<DeviceListMasterErrorDetail, DeviceListMasterErrorResponse>(
          saveDeviceListMasterDto.devDeviceUid,
          'devDeviceUid',
        );
        const normalizedDeviceType = normalizeRequiredText<DeviceListMasterErrorDetail, DeviceListMasterErrorResponse>(
          saveDeviceListMasterDto.devDeviceType,
          'devDeviceType',
        );
        const nextCompanyId = hasOwnProperty(saveDeviceListMasterDto, 'devCompanyId')
          ? (saveDeviceListMasterDto.devCompanyId ?? null)
          : existing.devCompanyId;
        await this.ensureDeviceUidIsUnique(tx, normalizedDeviceUid, nextCompanyId, devId);
        const data: Prisma.DeviceMasterUncheckedUpdateInput = {
          devDeviceUid: normalizedDeviceUid,
          devDeviceType: normalizedDeviceType,
          devModifiedOn: new Date(),
          devModifiedBy: resolveActor(saveDeviceListMasterDto.devModifiedBy),
        };
        applyPresentFields(data, saveDeviceListMasterDto, DEVICE_LIST_MASTER_OPTIONAL_FIELDS);
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
            userId: resolveActor(saveDeviceListMasterDto.devModifiedBy),
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
      devDeviceType: record.devDeviceType,
      devPlatform: record.devPlatform,
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