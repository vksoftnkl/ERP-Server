import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DropdownColumns, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ListDropdownColumnQueryDto } from './dto/list-dropdown-column-query.dto';
import { SaveDropdownColumnDto } from './dto/save-dropdown-column.dto';
import {
  DropdownColumnErrorDetail,
  DropdownColumnErrorResponse,
  DropdownColumnListMeta,
  DropdownColumnPayload,
} from './types/dropdown-column-api.types';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
type DropdownColumnWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class DropdownColumnsService {
  constructor(private readonly prisma: PrismaService) {}

  async save(saveDropdownColumnDto: SaveDropdownColumnDto): Promise<DropdownColumnPayload> {
    if (saveDropdownColumnDto.drop_columns_serial_id) {
      return this.updateDropdownColumn(saveDropdownColumnDto);
    }

    return this.createDropdownColumn(saveDropdownColumnDto);
  }

  async list(
    queryDto: ListDropdownColumnQueryDto,
  ): Promise<{ items: DropdownColumnPayload[]; meta: DropdownColumnListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const where: Prisma.DropdownColumnsWhereInput = {};

    if (queryDto.dropdown_id !== undefined) {
      where.dropColumnsDropdownId = this.parseIntId('dropdown_id', queryDto.dropdown_id);
    }

    if (queryDto.drop_columns_column_visiblity !== undefined) {
      where.dropColumnsColumnVisiblity = queryDto.drop_columns_column_visiblity;
    }

    if (queryDto.drop_columns_column_filter !== undefined) {
      where.dropColumnsColumnFilter = queryDto.drop_columns_column_filter;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { dropColumnsColumnName: { contains: search, mode: 'insensitive' } },
        { dropColumnsColumnAlias: { contains: search, mode: 'insensitive' } },
        { dropColumnsDataType: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.dropdownColumns.count({ where }),
      this.prisma.dropdownColumns.findMany({
        where,
        orderBy: [{ dropColumnsDropdownId: 'asc' }, { dropColumnsColumnNo: 'asc' }],
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

  async getById(dropColumnsSerialId: string): Promise<DropdownColumnPayload> {
    const parsedDropColumnsSerialId = this.parseBigIntId(
      'drop_columns_serial_id',
      dropColumnsSerialId,
    );

    const record = await this.prisma.dropdownColumns.findUnique({
      where: {
        dropColumnsSerialId: parsedDropColumnsSerialId,
      },
    });

    if (!record) {
      this.throwNotFound(dropColumnsSerialId);
    }

    return this.toPayload(record);
  }

  async delete(
    dropColumnsSerialId: string,
  ): Promise<{ drop_columns_serial_id: string; deleted: true }> {
    const parsedDropColumnsSerialId = this.parseBigIntId(
      'drop_columns_serial_id',
      dropColumnsSerialId,
    );

    const deleted = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.dropdownColumns.findUnique({
        where: {
          dropColumnsSerialId: parsedDropColumnsSerialId,
        },
        select: {
          dropColumnsSerialId: true,
        },
      });

      if (!existing) {
        return false;
      }

      await tx.dropdownColumns.delete({
        where: {
          dropColumnsSerialId: parsedDropColumnsSerialId,
        },
      });

      return true;
    });

    if (!deleted) {
      this.throwNotFound(dropColumnsSerialId);
    }

    return {
      drop_columns_serial_id: dropColumnsSerialId,
      deleted: true,
    };
  }

  private async createDropdownColumn(
    saveDropdownColumnDto: SaveDropdownColumnDto,
  ): Promise<DropdownColumnPayload> {
    const parsedDropdownId = this.parseIntId('dropdown_id', saveDropdownColumnDto.dropdown_id);

    return this.prisma.$transaction(async (tx) => {
      await this.ensureDropdownExists(parsedDropdownId, saveDropdownColumnDto.dropdown_id, tx);

      const data: Prisma.DropdownColumnsUncheckedCreateInput = {
        dropColumnsDropdownId: parsedDropdownId,
        dropColumnsColumnNo: saveDropdownColumnDto.drop_columns_column_no,
        dropColumnsDataType: saveDropdownColumnDto.drop_columns_data_type.trim(),
        dropColumnsColumnName: saveDropdownColumnDto.drop_columns_column_name.trim(),
      };

      this.applyOptionalFields(data, saveDropdownColumnDto);
      const created = await tx.dropdownColumns.create({ data });
      return this.toPayload(created);
    });
  }

  private async updateDropdownColumn(
    saveDropdownColumnDto: SaveDropdownColumnDto,
  ): Promise<DropdownColumnPayload> {
    const dropColumnsSerialId = saveDropdownColumnDto.drop_columns_serial_id!;
    const parsedDropColumnsSerialId = this.parseBigIntId(
      'drop_columns_serial_id',
      dropColumnsSerialId,
    );
    const parsedDropdownId = this.parseIntId('dropdown_id', saveDropdownColumnDto.dropdown_id);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.dropdownColumns.findUnique({
        where: {
          dropColumnsSerialId: parsedDropColumnsSerialId,
        },
      });

      if (!existing) {
        this.throwNotFound(dropColumnsSerialId);
      }

      await this.ensureDropdownExists(parsedDropdownId, saveDropdownColumnDto.dropdown_id, tx);

      const data: Prisma.DropdownColumnsUncheckedUpdateInput = {
        dropColumnsDropdownId: parsedDropdownId,
        dropColumnsColumnNo: saveDropdownColumnDto.drop_columns_column_no,
        dropColumnsDataType: saveDropdownColumnDto.drop_columns_data_type.trim(),
        dropColumnsColumnName: saveDropdownColumnDto.drop_columns_column_name.trim(),
      };

      this.applyOptionalFields(data, saveDropdownColumnDto);
      const updated = await tx.dropdownColumns.update({
        where: { dropColumnsSerialId: parsedDropColumnsSerialId },
        data,
      });

      return this.toPayload(updated);
    });
  }

  private async ensureDropdownExists(
    dropdownId: number,
    rawDropdownId: string,
    tx: DropdownColumnWriteClient = this.prisma,
  ): Promise<void> {
    const parentDropdown = await tx.dropdownDetails.findUnique({
      where: {
        dropdownId,
      },
      select: {
        dropdownId: true,
      },
    });

    if (!parentDropdown) {
      this.throwBadRequest('Validation error', [
        {
          field: 'dropdown_id',
          message: `No dropdown details found with id ${rawDropdownId}`,
        },
      ]);
    }
  }

  private applyOptionalFields(
    data:
      | Prisma.DropdownColumnsUncheckedCreateInput
      | Prisma.DropdownColumnsUncheckedUpdateInput,
    saveDropdownColumnDto: SaveDropdownColumnDto,
  ): void {
    if (this.hasOwnProperty(saveDropdownColumnDto, 'drop_columns_column_alias')) {
      data.dropColumnsColumnAlias = saveDropdownColumnDto.drop_columns_column_alias;
    }

    if (this.hasOwnProperty(saveDropdownColumnDto, 'drop_columns_column_width')) {
      data.dropColumnsColumnWidth = saveDropdownColumnDto.drop_columns_column_width;
    }

    if (this.hasOwnProperty(saveDropdownColumnDto, 'drop_columns_column_visiblity')) {
      data.dropColumnsColumnVisiblity = saveDropdownColumnDto.drop_columns_column_visiblity;
    }

    if (this.hasOwnProperty(saveDropdownColumnDto, 'drop_columns_column_allignment')) {
      data.dropColumnsColumnAllignment = saveDropdownColumnDto.drop_columns_column_allignment;
    }

    if (this.hasOwnProperty(saveDropdownColumnDto, 'drop_columns_column_filter')) {
      data.dropColumnsColumnFilter = saveDropdownColumnDto.drop_columns_column_filter;
    }
  }

  private toPayload(record: DropdownColumns): DropdownColumnPayload {
    return {
      drop_columns_serial_id: record.dropColumnsSerialId.toString(),
      dropdown_id: String(record.dropColumnsDropdownId),
      drop_columns_column_no: record.dropColumnsColumnNo,
      drop_columns_data_type: record.dropColumnsDataType,
      drop_columns_column_name: record.dropColumnsColumnName,
      drop_columns_column_alias: record.dropColumnsColumnAlias,
      drop_columns_column_width: this.toNullableNumber(record.dropColumnsColumnWidth),
      drop_columns_column_visiblity: record.dropColumnsColumnVisiblity,
      drop_columns_column_allignment: record.dropColumnsColumnAllignment,
      drop_columns_column_filter: record.dropColumnsColumnFilter,
      drop_columns_created_on: record.dropColumnsCreatedOn.toISOString(),
      drop_columns_modified_on: record.dropColumnsModifiedOn?.toISOString() ?? null,
    };
  }

  private toNullableNumber(value: Prisma.Decimal | null): number | null {
    return value === null ? null : Number(value);
  }

  private parseIntId(field: string, value: string): number {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
      this.throwBadRequest('Validation error', [
        {
          field,
          message: `${field} must be a numeric id`,
        },
      ]);
    }

    const parsed = Number(normalized);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      this.throwBadRequest('Validation error', [
        {
          field,
          message: `${field} must be a positive numeric id`,
        },
      ]);
    }

    return parsed;
  }

  private parseBigIntId(field: string, value: string): bigint {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
      this.throwBadRequest('Validation error', [
        {
          field,
          message: `${field} must be a numeric id`,
        },
      ]);
    }

    const parsed = BigInt(normalized);
    if (parsed <= 0n) {
      this.throwBadRequest('Validation error', [
        {
          field,
          message: `${field} must be a positive numeric id`,
        },
      ]);
    }

    return parsed;
  }

  private throwNotFound(dropColumnsSerialId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Dropdown column not found', [
        {
          field: 'drop_columns_serial_id',
          message: `No dropdown column found with id ${dropColumnsSerialId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: DropdownColumnErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: DropdownColumnErrorDetail[] = [],
  ): DropdownColumnErrorResponse {
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
