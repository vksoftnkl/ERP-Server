import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { ErpDeviceMaster, Prisma } from '@prisma/client';
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

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const DEVICE_LIST_MASTER_TABLE_NAME = 'erp_device_master';
const DEVICE_LIST_MASTER_AUDIT_SCREEN_NAME = 'Device List Master';

type DeviceListMasterWriteClient = Prisma.TransactionClient | PrismaService;

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
  ): Promise<{ items: DeviceListMasterListItem[]; meta: DeviceListMasterListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const hasStructuredFilters =
      queryDto.devCompanyId !== undefined ||
      queryDto.devIsActive !== undefined ||
      queryDto.devIsAllowed !== undefined ||
      queryDto.devIsBlocked !== undefined ||
      Boolean(queryDto.search?.trim());

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where: Prisma.ErpDeviceMasterWhereInput = {
      devIsDeleted: false,
    };

    if (queryDto.devCompanyId !== undefined) {
      where.devCompanyId = queryDto.devCompanyId;
    }

    if (queryDto.devIsActive !== undefined) {
      where.devIsActive = queryDto.devIsActive;
    }

    if (queryDto.devIsAllowed !== undefined) {
      where.devIsAllowed = queryDto.devIsAllowed;
    }

    if (queryDto.devIsBlocked !== undefined) {
      where.devIsBlocked = queryDto.devIsBlocked;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { devDeviceUid: { contains: search, mode: 'insensitive' } },
        { devDeviceName: { contains: search, mode: 'insensitive' } },
        { devDeviceType: { contains: search, mode: 'insensitive' } },
        { devPlatform: { contains: search, mode: 'insensitive' } },
        { devOsVersion: { contains: search, mode: 'insensitive' } },
        { devAppVersion: { contains: search, mode: 'insensitive' } },
        { devSerialNo: { contains: search, mode: 'insensitive' } },
        { devImei: { contains: search, mode: 'insensitive' } },
        { devMacAddress: { contains: search, mode: 'insensitive' } },
        { devLastIp: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.erpDeviceMaster.count({ where }),
      this.prisma.erpDeviceMaster.findMany({
        where,
        orderBy: [{ devCreatedOn: 'desc' }, { devId: 'desc' }],
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
  ): Promise<ConfiguredGridListResult<DeviceListMasterListItem, DeviceListMasterListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: DEVICE_LIST_MASTER_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      DEVICE_LIST_MASTER_TABLE_NAME,
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
      tableName: DEVICE_LIST_MASTER_TABLE_NAME,
    });
    if (!validation.isValid) {
      this.throwBadRequest('Invalid grid_sql configuration for device list master', [
        {
          field: 'grid_sql',
          message: validation.message,
        },
      ]);
    }

    try {
      const result = await this.configuredGridSqlService.runPagedQuery<DeviceListMasterListItem>({
        baseSql: validation.normalizedSql,
        alias: 'device_list_master_grid',
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
      this.throwBadRequest('Invalid grid_sql configuration for device list master', [
        {
          field: 'grid_sql',
          message: 'Configured query could not be executed for erp_device_master',
        },
      ]);
    }
  }

  async getById(devId: string): Promise<DeviceListMasterPayload> {
    const record = await this.prisma.erpDeviceMaster.findFirst({
      where: {
        devId,
        devIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(devId);
    }

    return this.toPayload(record);
  }

  async softDelete(devId: string): Promise<{ devId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.erpDeviceMaster.findFirst({
        where: {
          devId,
          devIsDeleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound(devId);
      }

      const sessionCount = await tx.userLoginSession.count({
        where: {
          ulsDeviceId: devId,
          ulsIsDeleted: false,
        },
      });

      if (sessionCount > 0) {
        this.throwBadRequest('Cannot delete device with active login sessions', [
          {
            field: 'devId',
            message: `Device ${devId} is used in ${sessionCount} login session(s).`,
          },
        ]);
      }

      const modifiedOn = new Date();
      const result = await tx.erpDeviceMaster.updateMany({
        where: {
          devId,
          devIsDeleted: false,
        },
        data: {
          devIsDeleted: true,
          devIsActive: false,
          devModifiedOn: modifiedOn,
          devModifiedBy: DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        this.throwNotFound(devId);
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

      return {
        devId,
        deleted: true,
      };
    });
  }

  private async createDevice(
    saveDeviceListMasterDto: SaveDeviceListMasterDto,
  ): Promise<DeviceListMasterPayload> {
    const normalizedDeviceUid = this.normalizeRequiredText(
      saveDeviceListMasterDto.devDeviceUid,
      'devDeviceUid',
    );
    const normalizedDeviceType = this.normalizeRequiredText(
      saveDeviceListMasterDto.devDeviceType,
      'devDeviceType',
    );
    const companyId = this.hasOwnProperty(saveDeviceListMasterDto, 'devCompanyId')
      ? (saveDeviceListMasterDto.devCompanyId ?? null)
      : null;
    const now = new Date();
    const createdBy = this.resolveActor(saveDeviceListMasterDto.devCreatedBy);
    const modifiedBy = this.resolveActor(saveDeviceListMasterDto.devModifiedBy, createdBy);
    const data: Prisma.ErpDeviceMasterUncheckedCreateInput = {
      devDeviceUid: normalizedDeviceUid,
      devDeviceType: normalizedDeviceType,
      devCreatedOn: now,
      devCreatedBy: createdBy,
      devModifiedOn: now,
      devModifiedBy: modifiedBy,
    };
    this.applyOptionalFields(data, saveDeviceListMasterDto);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureDeviceUidIsUnique(tx, normalizedDeviceUid, companyId);

        const created = await tx.erpDeviceMaster.create({ data });
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
      this.handleWriteError(error);
      throw error;
    }
  }

  private async updateDevice(
    saveDeviceListMasterDto: SaveDeviceListMasterDto,
  ): Promise<DeviceListMasterPayload> {
    const devId = saveDeviceListMasterDto.devId!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.erpDeviceMaster.findFirst({
          where: {
            devId,
            devIsDeleted: false,
          },
        });

        if (!existing) {
          this.throwNotFound(devId);
        }

        const normalizedDeviceUid = this.normalizeRequiredText(
          saveDeviceListMasterDto.devDeviceUid,
          'devDeviceUid',
        );
        const normalizedDeviceType = this.normalizeRequiredText(
          saveDeviceListMasterDto.devDeviceType,
          'devDeviceType',
        );
        const nextCompanyId = this.hasOwnProperty(saveDeviceListMasterDto, 'devCompanyId')
          ? (saveDeviceListMasterDto.devCompanyId ?? null)
          : existing.devCompanyId;

        await this.ensureDeviceUidIsUnique(tx, normalizedDeviceUid, nextCompanyId, devId);

        const data: Prisma.ErpDeviceMasterUncheckedUpdateInput = {
          devDeviceUid: normalizedDeviceUid,
          devDeviceType: normalizedDeviceType,
          devModifiedOn: new Date(),
          devModifiedBy: this.resolveActor(saveDeviceListMasterDto.devModifiedBy),
        };
        this.applyOptionalFields(data, saveDeviceListMasterDto);

        const updated = await tx.erpDeviceMaster.update({
          where: {
            devId,
          },
          data,
        });
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
            userId: this.resolveActor(saveDeviceListMasterDto.devModifiedBy),
            notes: 'Device updated',
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

  private async ensureDeviceUidIsUnique(
    tx: DeviceListMasterWriteClient,
    deviceUid: string,
    companyId: string | null,
    excludeId?: string,
  ): Promise<void> {
    const existing = await tx.erpDeviceMaster.findFirst({
      where: {
        devIsDeleted: false,
        devCompanyId: companyId,
        devDeviceUid: {
          equals: deviceUid,
          mode: 'insensitive',
        },
        ...(excludeId
          ? {
              devId: {
                not: excludeId,
              },
            }
          : {}),
      },
      select: {
        devId: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        this.buildErrorResponse('Device UID already exists', [
          {
            field: 'devDeviceUid',
            message: 'Duplicate devDeviceUid is not allowed',
          },
        ]),
      );
    }
  }

  private applyOptionalFields(
    data: Prisma.ErpDeviceMasterUncheckedCreateInput | Prisma.ErpDeviceMasterUncheckedUpdateInput,
    saveDeviceListMasterDto: SaveDeviceListMasterDto,
  ): void {
    if (this.hasOwnProperty(saveDeviceListMasterDto, 'devCompanyId')) {
      data.devCompanyId = saveDeviceListMasterDto.devCompanyId;
    }

    if (this.hasOwnProperty(saveDeviceListMasterDto, 'devBranchId')) {
      data.devBranchId = saveDeviceListMasterDto.devBranchId;
    }

    if (this.hasOwnProperty(saveDeviceListMasterDto, 'devUserId')) {
      data.devUserId = saveDeviceListMasterDto.devUserId;
    }

    if (this.hasOwnProperty(saveDeviceListMasterDto, 'devDeviceName')) {
      data.devDeviceName = saveDeviceListMasterDto.devDeviceName;
    }

    if (this.hasOwnProperty(saveDeviceListMasterDto, 'devPlatform')) {
      data.devPlatform = saveDeviceListMasterDto.devPlatform;
    }

    if (this.hasOwnProperty(saveDeviceListMasterDto, 'devOsVersion')) {
      data.devOsVersion = saveDeviceListMasterDto.devOsVersion;
    }

    if (this.hasOwnProperty(saveDeviceListMasterDto, 'devAppVersion')) {
      data.devAppVersion = saveDeviceListMasterDto.devAppVersion;
    }

    if (this.hasOwnProperty(saveDeviceListMasterDto, 'devSerialNo')) {
      data.devSerialNo = saveDeviceListMasterDto.devSerialNo;
    }

    if (this.hasOwnProperty(saveDeviceListMasterDto, 'devImei')) {
      data.devImei = saveDeviceListMasterDto.devImei;
    }

    if (this.hasOwnProperty(saveDeviceListMasterDto, 'devMacAddress')) {
      data.devMacAddress = saveDeviceListMasterDto.devMacAddress;
    }

    if (this.hasOwnProperty(saveDeviceListMasterDto, 'devProductKey')) {
      data.devProductKey = saveDeviceListMasterDto.devProductKey;
    }

    if (this.hasOwnProperty(saveDeviceListMasterDto, 'devIsAllowed')) {
      data.devIsAllowed = saveDeviceListMasterDto.devIsAllowed;
    }

    if (this.hasOwnProperty(saveDeviceListMasterDto, 'devIsBlocked')) {
      data.devIsBlocked = saveDeviceListMasterDto.devIsBlocked;
    }

    if (this.hasOwnProperty(saveDeviceListMasterDto, 'devAllowReason')) {
      data.devAllowReason = saveDeviceListMasterDto.devAllowReason;
    }

    if (this.hasOwnProperty(saveDeviceListMasterDto, 'devBlockReason')) {
      data.devBlockReason = saveDeviceListMasterDto.devBlockReason;
    }

    if (this.hasOwnProperty(saveDeviceListMasterDto, 'devLastSeenOn')) {
      data.devLastSeenOn = saveDeviceListMasterDto.devLastSeenOn;
    }

    if (this.hasOwnProperty(saveDeviceListMasterDto, 'devLastIp')) {
      data.devLastIp = saveDeviceListMasterDto.devLastIp;
    }

    if (this.hasOwnProperty(saveDeviceListMasterDto, 'devLastLoginOn')) {
      data.devLastLoginOn = saveDeviceListMasterDto.devLastLoginOn;
    }

    if (this.hasOwnProperty(saveDeviceListMasterDto, 'devIsActive')) {
      data.devIsActive = saveDeviceListMasterDto.devIsActive;
    }
  }

  private normalizeRequiredText(value: string, fieldName: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      this.throwBadRequest('Validation failed', [
        {
          field: fieldName,
          message: `${fieldName} must not be empty`,
        },
      ]);
    }

    return trimmed;
  }

  private toPayload(record: ErpDeviceMaster): DeviceListMasterPayload {
    return {
      devId: record.devId,
      devCompanyId: record.devCompanyId,
      devBranchId: record.devBranchId,
      devUserId: record.devUserId,
      devDeviceUid: record.devDeviceUid,
      devDeviceName: record.devDeviceName,
      devDeviceType: record.devDeviceType,
      devPlatform: record.devPlatform,
      devOsVersion: record.devOsVersion,
      devAppVersion: record.devAppVersion,
      devSerialNo: record.devSerialNo,
      devImei: record.devImei,
      devMacAddress: record.devMacAddress,
      devProductKey: record.devProductKey,
      devIsAllowed: record.devIsAllowed,
      devIsBlocked: record.devIsBlocked,
      devAllowReason: record.devAllowReason,
      devBlockReason: record.devBlockReason,
      devLastSeenOn: record.devLastSeenOn ? record.devLastSeenOn.toISOString() : null,
      devLastIp: record.devLastIp,
      devLastLoginOn: record.devLastLoginOn ? record.devLastLoginOn.toISOString() : null,
      devIsActive: record.devIsActive,
      devIsDeleted: record.devIsDeleted,
      devSyncDate: record.devSyncDate ? record.devSyncDate.toISOString() : null,
      devCreatedOn: record.devCreatedOn.toISOString(),
      devCreatedBy: record.devCreatedBy,
      devModifiedOn: record.devModifiedOn.toISOString(),
      devModifiedBy: record.devModifiedBy,
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
        this.buildErrorResponse('Device already exists', [
          {
            field: 'devDeviceUid',
            message: 'Duplicate devDeviceUid is not allowed',
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

  private throwNotFound(devId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Device not found', [
        {
          field: 'devId',
          message: `No active device found with id ${devId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: DeviceListMasterErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: DeviceListMasterErrorDetail[] = [],
  ): DeviceListMasterErrorResponse {
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
