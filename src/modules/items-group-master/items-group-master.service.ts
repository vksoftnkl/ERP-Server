import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ItemGroupMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ListItemGroupQueryDto } from './dto/list-item-group-query.dto';
import { SaveItemGroupDto } from './dto/save-item-group.dto';
import {
  ItemGroupErrorDetail,
  ItemGroupErrorResponse,
  ItemGroupListMeta,
  ItemGroupPayload,
} from './types/item-group-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

@Injectable()
export class ItemsGroupMasterService {
  constructor(private readonly prisma: PrismaService) {}

  async save(saveItemGroupDto: SaveItemGroupDto): Promise<ItemGroupPayload> {
    if (saveItemGroupDto.itg_id) {
      return this.updateItemGroup(saveItemGroupDto);
    }

    return this.createItemGroup(saveItemGroupDto);
  }

  async list(
    queryDto: ListItemGroupQueryDto,
  ): Promise<{ items: ItemGroupPayload[]; meta: ItemGroupListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const where: Prisma.ItemGroupMasterWhereInput = {
      itgIsDeleted: false,
    };

    if (queryDto.itg_parent_id !== undefined) {
      where.itgParentId = queryDto.itg_parent_id;
    }

    if (queryDto.itg_is_active !== undefined) {
      where.itgIsActive = queryDto.itg_is_active;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { itgName: { contains: search, mode: 'insensitive' } },
        { itgAlias: { contains: search, mode: 'insensitive' } },
        { itgDescription: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.itemGroupMaster.count({ where }),
      this.prisma.itemGroupMaster.findMany({
        where,
        orderBy: [{ itgSort: 'asc' }, { itgName: 'asc' }],
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

  async getById(itgId: string): Promise<ItemGroupPayload> {
    const record = await this.prisma.itemGroupMaster.findFirst({
      where: {
        itgId,
        itgIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(itgId);
    }

    return this.toPayload(record);
  }

  async softDelete(itgId: string): Promise<{ itg_id: string; deleted: true }> {
    const result = await this.prisma.itemGroupMaster.updateMany({
      where: {
        itgId,
        itgIsDeleted: false,
      },
      data: {
        itgIsDeleted: true,
        itgModifiedOn: new Date(),
        itgModifiedBy: DEFAULT_ACTOR,
      },
    });

    if (result.count === 0) {
      this.throwNotFound(itgId);
    }

    return {
      itg_id: itgId,
      deleted: true,
    };
  }

  private async createItemGroup(saveItemGroupDto: SaveItemGroupDto): Promise<ItemGroupPayload> {
    if (saveItemGroupDto.itg_parent_id) {
      await this.ensureParentExists(saveItemGroupDto.itg_parent_id);
    }

    const now = new Date();
    const createdBy = DEFAULT_ACTOR;
    const modifiedBy = createdBy;

    const data: Prisma.ItemGroupMasterUncheckedCreateInput = {
      itgName: saveItemGroupDto.itg_name.trim(),
      itgCreatedOn: now,
      itgCreatedBy: createdBy,
      itgModifiedOn: now,
      itgModifiedBy: modifiedBy,
    };

    this.applyOptionalFields(data, saveItemGroupDto);

    try {
      const created = await this.prisma.itemGroupMaster.create({ data });
      return this.toPayload(created);
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  private async updateItemGroup(saveItemGroupDto: SaveItemGroupDto): Promise<ItemGroupPayload> {
    const itgId = saveItemGroupDto.itg_id!;

    const existing = await this.prisma.itemGroupMaster.findFirst({
      where: {
        itgId,
        itgIsDeleted: false,
      },
    });

    if (!existing) {
      this.throwNotFound(itgId);
    }

    if (saveItemGroupDto.itg_parent_id === itgId) {
      this.throwBadRequest('Item group cannot be its own parent', [
        {
          field: 'itg_parent_id',
          message: 'itg_parent_id cannot be same as itg_id',
        },
      ]);
    }

    if (saveItemGroupDto.itg_parent_id) {
      await this.ensureParentExists(saveItemGroupDto.itg_parent_id);
    }

    const data: Prisma.ItemGroupMasterUncheckedUpdateInput = {
      itgName: saveItemGroupDto.itg_name.trim(),
      itgModifiedOn: new Date(),
      itgModifiedBy: DEFAULT_ACTOR,
    };

    this.applyOptionalFields(data, saveItemGroupDto);

    try {
      const updated = await this.prisma.itemGroupMaster.update({
        where: {
          itgId,
        },
        data,
      });

      return this.toPayload(updated);
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  private async ensureParentExists(parentId: string): Promise<void> {
    const parent = await this.prisma.itemGroupMaster.findFirst({
      where: {
        itgId: parentId,
        itgIsDeleted: false,
      },
      select: {
        itgId: true,
      },
    });

    if (!parent) {
      this.throwBadRequest('Parent item group does not exist', [
        {
          field: 'itg_parent_id',
          message: `No active item group found with id ${parentId}`,
        },
      ]);
    }
  }

  private applyOptionalFields(
    data: Prisma.ItemGroupMasterUncheckedCreateInput | Prisma.ItemGroupMasterUncheckedUpdateInput,
    saveItemGroupDto: SaveItemGroupDto,
  ): void {
    if (this.hasOwnProperty(saveItemGroupDto, 'itg_alias')) {
      data.itgAlias = saveItemGroupDto.itg_alias;
    }

    if (this.hasOwnProperty(saveItemGroupDto, 'itg_short')) {
      data.itgShort = saveItemGroupDto.itg_short;
    }

    if (this.hasOwnProperty(saveItemGroupDto, 'itg_description')) {
      data.itgDescription = saveItemGroupDto.itg_description;
    }

    if (this.hasOwnProperty(saveItemGroupDto, 'itg_parent_id')) {
      data.itgParentId = saveItemGroupDto.itg_parent_id;
    }

    if (this.hasOwnProperty(saveItemGroupDto, 'itg_sort')) {
      data.itgSort = saveItemGroupDto.itg_sort;
    }

    if (this.hasOwnProperty(saveItemGroupDto, 'itg_level')) {
      data.itgLevel = saveItemGroupDto.itg_level;
    }

    if (this.hasOwnProperty(saveItemGroupDto, 'itg_path_ids_cache')) {
      data.itgPathIdsCache = saveItemGroupDto.itg_path_ids_cache;
    }

    if (this.hasOwnProperty(saveItemGroupDto, 'itg_tax_claim')) {
      data.itgTaxClaim = saveItemGroupDto.itg_tax_claim;
    }

    if (this.hasOwnProperty(saveItemGroupDto, 'itg_default_tax_id')) {
      data.itgDefaultTaxId = saveItemGroupDto.itg_default_tax_id;
    }

    if (this.hasOwnProperty(saveItemGroupDto, 'itg_default_hsn')) {
      data.itgDefaultHsn = saveItemGroupDto.itg_default_hsn;
    }

    if (this.hasOwnProperty(saveItemGroupDto, 'itg_default_uom_id')) {
      data.itgDefaultUomId = saveItemGroupDto.itg_default_uom_id;
    }

    if (this.hasOwnProperty(saveItemGroupDto, 'itg_photo')) {
      data.itgPhoto = this.decodePhotoInput(saveItemGroupDto.itg_photo);
    }

    if (this.hasOwnProperty(saveItemGroupDto, 'itg_photo_url')) {
      data.itgPhotoUrl = saveItemGroupDto.itg_photo_url;
    }
  }

  private decodePhotoInput(
    photo: string | null | undefined,
  ): Uint8Array<ArrayBuffer> | null | undefined {
    if (photo === undefined) {
      return undefined;
    }

    if (photo === null) {
      return null;
    }

    const trimmed = photo.trim();
    if (!trimmed) {
      this.throwBadRequest('Invalid base64 image provided', [
        {
          field: 'itg_photo',
          message: 'itg_photo must be a non-empty base64 string',
        },
      ]);
    }

    const candidate = trimmed.includes(',') ? (trimmed.split(',').pop() ?? '') : trimmed;
    const normalized = candidate.replace(/\s+/g, '');

    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
      this.throwBadRequest('Invalid base64 image provided', [
        {
          field: 'itg_photo',
          message: 'itg_photo must be valid base64 content',
        },
      ]);
    }

    return new Uint8Array(Buffer.from(normalized, 'base64'));
  }

  private toPayload(record: ItemGroupMaster): ItemGroupPayload {
    return {
      itg_id: record.itgId,
      itg_name: record.itgName,
      itg_alias: record.itgAlias,
      itg_short: record.itgShort,
      itg_description: record.itgDescription,
      itg_parent_id: record.itgParentId,
      itg_sort: record.itgSort,
      itg_level: record.itgLevel,
      itg_path_ids_cache: record.itgPathIdsCache,
      itg_tax_claim: record.itgTaxClaim,
      itg_default_tax_id: record.itgDefaultTaxId,
      itg_default_hsn: record.itgDefaultHsn,
      itg_default_uom_id: record.itgDefaultUomId,
      itg_photo: record.itgPhoto ? Buffer.from(record.itgPhoto).toString('base64') : null,
      itg_photo_url: record.itgPhotoUrl,
      itg_sync_date: record.itgSyncDate ? record.itgSyncDate.toISOString() : null,
      itg_is_active: record.itgIsActive,
      itg_is_deleted: record.itgIsDeleted,
      itg_created_on: record.itgCreatedOn.toISOString(),
      itg_created_by: record.itgCreatedBy,
      itg_modified_on: record.itgModifiedOn.toISOString(),
      itg_modified_by: record.itgModifiedBy,
    };
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Item group name already exists', [
          {
            field: 'itg_name',
            message: 'Duplicate itg_name is not allowed',
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

  private throwNotFound(itgId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Item group not found', [
        {
          field: 'itg_id',
          message: `No active item group found with id ${itgId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: ItemGroupErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: ItemGroupErrorDetail[] = [],
  ): ItemGroupErrorResponse {
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
