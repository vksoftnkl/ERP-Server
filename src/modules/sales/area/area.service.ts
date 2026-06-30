import { Injectable } from '@nestjs/common';
import { AreaMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveAreaDto } from './dto/save-area.dto';
import {
  AreaErrorDetail,
  AreaErrorResponse,
  AreaMasterCreateResult,
  AreaPayload,
} from './types/area-api.types';
import {
  DEFAULT_ACTOR,
  SalesWriteClient,
  applyPresentFields,
  hasOwnProperty,
  normalizeRequiredText,
  resolveActor,
  throwOnUniqueConstraintError,
  throwSalesBadRequest,
  throwSalesConflict,
  throwSalesNotFound,
  toNumber,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
const AREA_TABLE_NAME = 'area master';
const AREA_AUDIT_SCREEN_NAME = 'Area Master';
const AREA_OPTIONAL_FIELDS = [
  'armAlias',
  'armShort',
  'armSort',
  'armDistanceKm',
  'armCollectionDays',
  'armDescription',
  'armIsActive',
];
// Fixed parent account group. An area master's account group is always created under it.
const AREA_ACCOUNT_GROUP_PARENT_ID = '019f081c-6764-73b0-b397-3f30a6efe73e';
type AreaWriteClient = SalesWriteClient;
@Injectable()
export class AreaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(saveAreaDto: SaveAreaDto): Promise<AreaPayload> {
    if (saveAreaDto.armId) {
      return this.updateArea(saveAreaDto);
    }
    const userId = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    const { areaMaster } = await this.createAreaMaster(saveAreaDto, userId);
    return areaMaster;
  }
  async createAreaMaster(
    dto: SaveAreaDto,
    userId: string,
    // parentId is a separate argument because it can't come from the area payload. For this flow
    // it defaults to the fixed parent account group; callers may override it.
    parentId: string = AREA_ACCOUNT_GROUP_PARENT_ID,
  ): Promise<AreaMasterCreateResult> {
    const normalizedName = normalizeRequiredText<AreaErrorDetail, AreaErrorResponse>(
      dto.armName,
      'armName',
    );
    const actor = resolveActor(dto.armCreatedBy, userId);
    const now = new Date();
    // armIsActive collapses onto soft-delete state: active => is_deleted false, inactive => true.
    const isDeleted = dto.armIsActive === false;
    const sort = dto.armSort ?? 0;
    try {
      // $transaction is the rollback boundary: the account group insert and the area master
      // insert commit together. Any throw below (including the second insert failing) rolls
      // back BOTH rows.
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureCityExists(tx, dto.armCityId);
        await this.ensureNameIsUnique(tx, normalizedName, dto.armCityId);
        // acc_group_type / company / nature / ledger profile are required (or NOT NULL) on
        // account_groups and are never client-supplied — inherit them from the parent group.
        const parent = await tx.accountGroup.findFirst({
          where: {
            accGroupId: parentId,
            accGroupIsDeleted: false,
          },
          select: {
            accGroupCompanyId: true,
            accGroupType: true,
            accLedgerProfile: true,
            accGroupNature: true,
          },
        });
        if (!parent) {
          throwSalesBadRequest<AreaErrorDetail, AreaErrorResponse>(
            'Parent account group does not exist',
            [
              {
                field: 'parentId',
                message: `No active account group found with id ${parentId}`,
              },
            ],
          );
        }
        // Create the account group derived from the area fields; capture acc_group_id.
        const accountGroupData: Prisma.AccountGroupUncheckedCreateInput = {
          accGroupName: normalizedName, // <- armName
          accGroupShort: dto.armShort ?? null, // <- armShort
          // acc_group_description is VarChar(250) while the master column is unbounded Text;
          // cap the mirror so an over-long description can't abort the whole transaction.
          accGroupDescription: dto.armDescription?.slice(0, 250) ?? null, // <- armDescription
          accGroupSort: Math.trunc(sort), // <- armSort (acc_group_sort is Int)
          accGroupParentId: parentId, // <- parentId argument
          accGroupCompanyId: parent.accGroupCompanyId,
          accGroupType: parent.accGroupType,
          accLedgerProfile: parent.accLedgerProfile,
          accGroupNature: parent.accGroupNature,
          accGroupChildIds: [],
          accGroupIsActive: !isDeleted,
          accGroupIsDeleted: isDeleted,
          accGroupCreatedOn: now,
          accGroupCreatedBy: actor,
          accGroupModifiedOn: now,
          accGroupModifiedBy: actor,
        };
        const accountGroup = await tx.accountGroup.create({ data: accountGroupData });
        const accGroupId = accountGroup.accGroupId;
        // The area master shares its PK with the account group. arm_id is set EXPLICITLY to
        // acc_group_id, overriding the uuidv7() default, so the two rows share one id.
        const areaData: Prisma.AreaMasterUncheckedCreateInput = {
          armId: accGroupId,
          armName: normalizedName,
          armAlias: dto.armAlias ?? null,
          armShort: dto.armShort ?? null,
          armCityId: dto.armCityId,
          armSort: sort,
          armDescription: dto.armDescription ?? null,
          armCollectionDays: hasOwnProperty(dto, 'armCollectionDays')
            ? (dto.armCollectionDays ?? [])
            : [],
          armIsActive: !isDeleted,
          armIsDeleted: isDeleted,
          armCreatedOn: now,
          armCreatedBy: actor,
          armModifiedOn: now,
          armModifiedBy: actor,
        };
        // armDistanceKm is nullable with a DB default of 0 — only write it when the client sent
        // it, so an omitted value keeps the default rather than being forced to null.
        if (hasOwnProperty(dto, 'armDistanceKm')) {
          areaData.armDistanceKm = dto.armDistanceKm ?? null;
        }
        const created = await tx.areaMaster.create({ data: areaData });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: AREA_TABLE_NAME,
            screenName: AREA_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.armId,
            displayName: payload.armName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: actor,
            notes: 'Area created with linked account group',
          },
          tx,
        );
        return { areaMaster: payload, accGroupId };
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<AreaErrorDetail, AreaErrorResponse>(
        error,
        'Area already exists',
        [
          {
            field: 'armName',
            message: 'Duplicate armName is not allowed',
          },
        ],
      );
      throw error;
    }
  }
  async getById(armId: string): Promise<AreaPayload> {
    const record = await this.prisma.areaMaster.findFirst({
      where: {
        armId,
        armIsDeleted: false,
      },
    });
    if (!record) {
      throwSalesNotFound<AreaErrorDetail, AreaErrorResponse>(
        'Area not found',
        'armId',
        `No active area found with id ${armId}`,
      );
    }
    const payload = this.toPayload(record);
    payload.armCityName = await this.getCityName(this.prisma, record.armCityId);
    return payload;
  }
  async softDelete(armId: string): Promise<{ armId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.areaMaster.findFirst({
        where: {
          armId,
          armIsDeleted: false,
        },
      });
      if (!existing) {
        throwSalesNotFound<AreaErrorDetail, AreaErrorResponse>(
          'Area not found',
          'armId',
          `No active area found with id ${armId}`,
        );
      }
      const customerCount = await tx.customer.count({
        where: {
          cusAreaId: armId,
          cusIsDeleted: false,
        },
      });
      if (customerCount > 0) {
        throwSalesBadRequest<AreaErrorDetail, AreaErrorResponse>(
          'Cannot delete area with active customers',
          [
            {
              field: 'armId',
              message: `Area ${armId} is used by ${customerCount} customer(s).`,
            },
          ],
        );
      }
      const modifiedOn = new Date();
      const result = await tx.areaMaster.updateMany({
        where: {
          armId,
          armIsDeleted: false,
        },
        data: {
          armIsDeleted: true,
          armIsActive: false,
          armModifiedOn: modifiedOn,
          armModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        throwSalesNotFound<AreaErrorDetail, AreaErrorResponse>(
          'Area not found',
          'armId',
          `No active area found with id ${armId}`,
        );
      }
      // Mirror the soft delete onto the linked account group (shares arm_id as its PK) so it
      // can't stay active while the area is logically deleted. No-op for legacy rows.
      await tx.accountGroup.updateMany({
        where: { accGroupId: armId },
        data: {
          accGroupIsActive: false,
          accGroupIsDeleted: true,
          accGroupModifiedOn: modifiedOn,
          accGroupModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        },
      });
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        armIsDeleted: true,
        armIsActive: false,
        armModifiedOn: modifiedOn,
        armModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: AREA_TABLE_NAME,
          screenName: AREA_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: armId,
          displayName: existing.armName,
          originalRecord,
          modifiedRecord,
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
          notes: 'Area soft deleted',
        },
        tx,
      );
      return {
        armId,
        deleted: true,
      };
    });
  }
  // Standalone area create (no linked account group). Superseded by createAreaMaster, which
  // creates the account group first and reuses its id as arm_id. Kept for reference.
  // private async createArea(saveAreaDto: SaveAreaDto): Promise<AreaPayload> {
  //   const normalizedName = normalizeRequiredText<AreaErrorDetail, AreaErrorResponse>(
  //     saveAreaDto.armName,
  //     'armName',
  //   );
  //   const now = new Date();
  //   const createdBy = resolveActor(saveAreaDto.armCreatedBy, this.requestContextService.getUserId());
  //   const data: Prisma.AreaMasterUncheckedCreateInput = {
  //     armName: normalizedName,
  //     armCityId: saveAreaDto.armCityId,
  //     armCollectionDays: hasOwnProperty(saveAreaDto, 'armCollectionDays')
  //       ? (saveAreaDto.armCollectionDays ?? [])
  //       : [],
  //     armCreatedOn: now,
  //     armCreatedBy: createdBy,
  //   };
  //   this.applyOptionalFields(data, saveAreaDto);
  //   try {
  //     return await this.prisma.$transaction(async (tx) => {
  //       await this.ensureCityExists(tx, data.armCityId);
  //       await this.ensureNameIsUnique(tx, normalizedName, data.armCityId);
  //       const created = await tx.areaMaster.create({ data });
  //       const payload = this.toPayload(created);
  //       await this.auditLogService.logEntityChange(
  //         {
  //           action: 'New',
  //           tableName: AREA_TABLE_NAME,
  //           screenName: AREA_AUDIT_SCREEN_NAME,
  //           screenType: 'master',
  //           pk: payload.armId,
  //           displayName: payload.armName,
  //           originalRecord: null,
  //           modifiedRecord: payload,
  //           userId: createdBy,
  //           notes: 'Area created',
  //         },
  //         tx,
  //       );
  //       return payload;
  //     });
  //   } catch (error: unknown) {
  //     throwOnUniqueConstraintError<AreaErrorDetail, AreaErrorResponse>(
  //       error,
  //       'Area already exists',
  //       [
  //         {
  //           field: 'armName',
  //           message: 'Duplicate armName is not allowed',
  //         },
  //       ],
  //     );
  //     throw error;
  //   }
  // }
  private async updateArea(saveAreaDto: SaveAreaDto): Promise<AreaPayload> {
    const armId = saveAreaDto.armId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.areaMaster.findFirst({
          where: {
            armId,
            armIsDeleted: false,
          },
        });
        if (!existing) {
          throwSalesNotFound<AreaErrorDetail, AreaErrorResponse>(
            'Area not found',
            'armId',
            `No active area found with id ${armId}`,
          );
        }
        const normalizedName = normalizeRequiredText<AreaErrorDetail, AreaErrorResponse>(
          saveAreaDto.armName,
          'armName',
        );
        const nextCityId = hasOwnProperty(saveAreaDto, 'armCityId')
          ? saveAreaDto.armCityId
          : existing.armCityId;
        await this.ensureCityExists(tx, nextCityId);
        await this.ensureNameIsUnique(tx, normalizedName, nextCityId, armId);
        const data: Prisma.AreaMasterUncheckedUpdateInput = {
          armName: normalizedName,
          armCityId: nextCityId,
          armModifiedOn: new Date(),
          armModifiedBy: resolveActor(
            saveAreaDto.armModifiedBy,
            this.requestContextService.getUserId(),
          ),
        };
        this.applyOptionalFields(data, saveAreaDto);
        const updated = await tx.areaMaster.update({
          where: {
            armId,
          },
          data,
        });
        // Keep the linked account group (shares arm_id as its PK) in sync with the mirrored
        // area fields, the same subset the create flow derives. updateMany is a no-op for
        // legacy rows that have no linked group, so it can't fail the update.
        await tx.accountGroup.updateMany({
          where: { accGroupId: armId },
          data: {
            accGroupName: updated.armName,
            accGroupShort: updated.armShort,
            accGroupDescription: updated.armDescription?.slice(0, 250) ?? null,
            accGroupSort: Math.trunc(toNumber(updated.armSort)),
            accGroupIsActive: updated.armIsActive,
            accGroupIsDeleted: updated.armIsDeleted,
            accGroupModifiedOn: updated.armModifiedOn,
            accGroupModifiedBy: updated.armModifiedBy,
          },
        });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: AREA_TABLE_NAME,
            screenName: AREA_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: armId,
            displayName: payload.armName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.armModifiedBy,
            notes: 'Area updated',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<AreaErrorDetail, AreaErrorResponse>(
        error,
        'Area already exists',
        [
          {
            field: 'armName',
            message: 'Duplicate armName is not allowed',
          },
        ],
      );
      throw error;
    }
  }
  private async getCityName(client: AreaWriteClient, cityId: string): Promise<string | null> {
    if (!cityId) {
      return null;
    }
    const city = await client.cityMaster.findFirst({
      where: { ctmId: cityId },
      select: { ctmName: true },
    });
    return city?.ctmName ?? null;
  }

  private async ensureCityExists(tx: AreaWriteClient, cityId: string): Promise<void> {
    const city = await tx.cityMaster.findFirst({
      where: {
        ctmId: cityId,
        ctmIsDeleted: false,
      },
      select: {
        ctmId: true,
      },
    });
    if (!city) {
      throwSalesBadRequest<AreaErrorDetail, AreaErrorResponse>('City does not exist', [
        {
          field: 'armCityId',
          message: `No active city found with id ${cityId}`,
        },
      ]);
    }
  }
  private async ensureNameIsUnique(
    tx: AreaWriteClient,
    areaName: string,
    cityId: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await tx.areaMaster.findFirst({
      where: {
        armIsDeleted: false,
        armCityId: cityId,
        armName: {
          equals: areaName,
          mode: 'insensitive',
        },
        ...(excludeId
          ? {
              armId: {
                not: excludeId,
              },
            }
          : {}),
      },
      select: {
        armId: true,
      },
    });
    if (existing) {
      throwSalesConflict<AreaErrorDetail, AreaErrorResponse>(
        'Area name already exists for this city',
        [
          {
            field: 'armName',
            message: 'Duplicate area name is not allowed for this city',
          },
        ],
      );
    }
  }
  private applyOptionalFields(
    data: Prisma.AreaMasterUncheckedCreateInput | Prisma.AreaMasterUncheckedUpdateInput,
    saveAreaDto: SaveAreaDto,
  ): void {
    applyPresentFields(data, saveAreaDto, AREA_OPTIONAL_FIELDS);
  }
  private toPayload(record: AreaMaster): AreaPayload {
    return {
      armId: record.armId,
      armName: record.armName,
      armAlias: record.armAlias,
      armShort: record.armShort,
      armCityId: record.armCityId,
      armSort: toNumber(record.armSort),
      armDistanceKm: record.armDistanceKm,
      armCollectionDays: record.armCollectionDays,
      armDescription: record.armDescription,
      armIsActive: record.armIsActive,
      armIsDeleted: record.armIsDeleted,
      armSyncDate: record.armSyncDate ? record.armSyncDate.toISOString() : null,
      armCreatedOn: record.armCreatedOn.toISOString(),
      armCreatedBy: record.armCreatedBy,
      armModifiedOn: record.armModifiedOn.toISOString(),
      armModifiedBy: record.armModifiedBy,
    };
  }
}
