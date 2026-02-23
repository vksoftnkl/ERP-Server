import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccShipAddr, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListLedgerShippingAddressQueryDto } from './dto/list-ledger-shipping-address-query.dto';
import { SaveLedgerShippingAddressDto } from './dto/save-ledger-shipping-address.dto';
import {
  LedgerShippingAddressErrorDetail,
  LedgerShippingAddressErrorResponse,
  LedgerShippingAddressListItem,
  LedgerShippingAddressListMeta,
  LedgerShippingAddressPayload,
} from './types/ledger-shipping-address-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const LEDGER_SHIPPING_ADDRESS_TABLE_NAME = 'acc_ship_addrs';
const LEDGER_SHIPPING_ADDRESS_AUDIT_SCREEN_NAME = 'Ledger Shipping Address';
const DEFAULT_ADDR_TYPE = 'SHIP_TO';

type LedgerShippingAddressWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class LedgerShippingAddressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async save(
    saveLedgerShippingAddressDto: SaveLedgerShippingAddressDto,
  ): Promise<LedgerShippingAddressPayload> {
    if (saveLedgerShippingAddressDto.saaId) {
      return this.updateAddress(saveLedgerShippingAddressDto);
    }

    return this.createAddress(saveLedgerShippingAddressDto);
  }

  async list(
    queryDto: ListLedgerShippingAddressQueryDto,
  ): Promise<{ items: LedgerShippingAddressListItem[]; meta: LedgerShippingAddressListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const where: Prisma.AccShipAddrWhereInput = {
      saaIsDeleted: false,
    };

    if (queryDto.saaCompanyId !== undefined) {
      where.saaCompanyId = queryDto.saaCompanyId as string | null;
    }

    if (queryDto.saaLedgerId !== undefined) {
      where.saaLedgerId = queryDto.saaLedgerId;
    }

    if (queryDto.saaAddrType?.trim()) {
      where.saaAddrType = queryDto.saaAddrType.trim().toUpperCase();
    }

    if (queryDto.saaIsActive !== undefined) {
      where.saaIsActive = queryDto.saaIsActive;
    }

    if (queryDto.saaIsDefault !== undefined) {
      where.saaIsDefault = queryDto.saaIsDefault;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { saaTrdnm: { contains: search, mode: 'insensitive' } },
        { saaContactName: { contains: search, mode: 'insensitive' } },
        { saaAddr1: { contains: search, mode: 'insensitive' } },
        { saaAddr2: { contains: search, mode: 'insensitive' } },
        { saaAddr3: { contains: search, mode: 'insensitive' } },
        { saaLoc: { contains: search, mode: 'insensitive' } },
        { saaPin: { contains: search, mode: 'insensitive' } },
        { saaStateCode: { contains: search, mode: 'insensitive' } },
        { saaStateName: { contains: search, mode: 'insensitive' } },
        { saaPhone: { contains: search, mode: 'insensitive' } },
        { saaEmail: { contains: search, mode: 'insensitive' } },
        { saaGstin: { contains: search, mode: 'insensitive' } },
        { saaPan: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.accShipAddr.count({ where }),
      this.prisma.accShipAddr.findMany({
        where,
        orderBy: [
          { saaLedgerId: 'asc' },
          { saaAddrType: 'asc' },
          { saaIsDefault: 'desc' },
          { saaSort: 'asc' },
          { saaCreatedOn: 'desc' },
          { saaId: 'asc' },
        ],
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

  async getById(saaId: string): Promise<LedgerShippingAddressPayload> {
    const record = await this.prisma.accShipAddr.findFirst({
      where: {
        saaId,
        saaIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(saaId);
    }

    return this.toPayload(record);
  }

  async softDelete(saaId: string): Promise<{ saaId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.accShipAddr.findFirst({
        where: {
          saaId,
          saaIsDeleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound(saaId);
      }

      const modifiedOn = new Date();
      const result = await tx.accShipAddr.updateMany({
        where: {
          saaId,
          saaIsDeleted: false,
        },
        data: {
          saaIsDeleted: true,
          saaIsActive: false,
          saaModifiedOn: modifiedOn,
          saaModifiedBy: DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        this.throwNotFound(saaId);
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        saaIsDeleted: true,
        saaIsActive: false,
        saaModifiedOn: modifiedOn,
        saaModifiedBy: DEFAULT_ACTOR,
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: LEDGER_SHIPPING_ADDRESS_TABLE_NAME,
          screenName: LEDGER_SHIPPING_ADDRESS_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: saaId,
          displayName: this.resolveDisplayName(existing),
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Ledger shipping address soft deleted',
        },
        tx,
      );

      return {
        saaId,
        deleted: true,
      };
    });
  }

  private async createAddress(
    saveLedgerShippingAddressDto: SaveLedgerShippingAddressDto,
  ): Promise<LedgerShippingAddressPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const saaAddrType = this.normalizeAddressType(
          saveLedgerShippingAddressDto.saaAddrType ?? DEFAULT_ADDR_TYPE,
        );

        await this.ensureLedgerExists(saveLedgerShippingAddressDto.saaLedgerId, tx);

        if (
          this.hasOwnProperty(saveLedgerShippingAddressDto, 'saaCompanyId') &&
          saveLedgerShippingAddressDto.saaCompanyId !== null &&
          saveLedgerShippingAddressDto.saaCompanyId !== undefined
        ) {
          await this.ensureCompanyExists(saveLedgerShippingAddressDto.saaCompanyId, tx);
        }

        if (saveLedgerShippingAddressDto.saaIsDefault === true) {
          await this.clearDefaultAddress(tx, saveLedgerShippingAddressDto.saaLedgerId, saaAddrType);
        }

        const now = new Date();
        const data: Prisma.AccShipAddrUncheckedCreateInput = {
          saaLedgerId: saveLedgerShippingAddressDto.saaLedgerId,
          saaAddrType,
          saaCreatedOn: now,
          saaCreatedBy: DEFAULT_ACTOR,
          saaModifiedOn: now,
          saaModifiedBy: DEFAULT_ACTOR,
        };

        this.applyOptionalFields(data, saveLedgerShippingAddressDto);

        const created = await tx.accShipAddr.create({ data });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: LEDGER_SHIPPING_ADDRESS_TABLE_NAME,
            screenName: LEDGER_SHIPPING_ADDRESS_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.saaId,
            displayName: this.resolveDisplayName(payload),
            originalRecord: null,
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Ledger shipping address created',
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

  private async updateAddress(
    saveLedgerShippingAddressDto: SaveLedgerShippingAddressDto,
  ): Promise<LedgerShippingAddressPayload> {
    const saaId = saveLedgerShippingAddressDto.saaId!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.accShipAddr.findFirst({
          where: {
            saaId,
            saaIsDeleted: false,
          },
        });

        if (!existing) {
          this.throwNotFound(saaId);
        }

        const nextAddrType = this.normalizeAddressType(
          saveLedgerShippingAddressDto.saaAddrType ?? existing.saaAddrType,
        );
        const nextLedgerId = saveLedgerShippingAddressDto.saaLedgerId;
        const nextCompanyId = this.hasOwnProperty(saveLedgerShippingAddressDto, 'saaCompanyId')
          ? (saveLedgerShippingAddressDto.saaCompanyId ?? null)
          : existing.saaCompanyId;
        const nextIsDefault = this.hasOwnProperty(saveLedgerShippingAddressDto, 'saaIsDefault')
          ? (saveLedgerShippingAddressDto.saaIsDefault ?? false)
          : existing.saaIsDefault;

        await this.ensureLedgerExists(nextLedgerId, tx);

        if (nextCompanyId !== null) {
          await this.ensureCompanyExists(nextCompanyId, tx);
        }

        if (nextIsDefault) {
          await this.clearDefaultAddress(tx, nextLedgerId, nextAddrType, saaId);
        }

        const data: Prisma.AccShipAddrUncheckedUpdateInput = {
          saaLedgerId: nextLedgerId,
          saaAddrType: nextAddrType,
          saaModifiedOn: new Date(),
          saaModifiedBy: DEFAULT_ACTOR,
        };

        this.applyOptionalFields(data, saveLedgerShippingAddressDto);

        const updated = await tx.accShipAddr.update({
          where: {
            saaId,
          },
          data,
        });
        const payload = this.toPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: LEDGER_SHIPPING_ADDRESS_TABLE_NAME,
            screenName: LEDGER_SHIPPING_ADDRESS_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: saaId,
            displayName: this.resolveDisplayName(payload),
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Ledger shipping address updated',
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

  private async ensureLedgerExists(
    ledgerId: string,
    tx: LedgerShippingAddressWriteClient,
  ): Promise<void> {
    const ledger = await tx.accLedgerMaster.findFirst({
      where: {
        ledId: ledgerId,
        ledIsDeleted: false,
      },
      select: {
        ledId: true,
      },
    });

    if (!ledger) {
      this.throwBadRequest('Ledger does not exist', [
        {
          field: 'saaLedgerId',
          message: `No active ledger found with id ${ledgerId}`,
        },
      ]);
    }
  }

  private async ensureCompanyExists(
    companyId: number,
    tx: LedgerShippingAddressWriteClient,
  ): Promise<void> {
    const company = await tx.company.findFirst({
      where: {
        compId: companyId,
        compIsDeleted: false,
      },
      select: {
        compId: true,
      },
    });

    if (!company) {
      this.throwBadRequest('Company does not exist', [
        {
          field: 'saaCompanyId',
          message: `No active company found with id ${companyId}`,
        },
      ]);
    }
  }

  private async clearDefaultAddress(
    tx: LedgerShippingAddressWriteClient,
    ledgerId: string,
    addrType: string,
    excludeSaaId?: string,
  ): Promise<void> {
    await tx.accShipAddr.updateMany({
      where: {
        saaLedgerId: ledgerId,
        saaAddrType: addrType,
        saaIsDeleted: false,
        saaIsDefault: true,
        ...(excludeSaaId
          ? {
              saaId: {
                not: excludeSaaId,
              },
            }
          : {}),
      },
      data: {
        saaIsDefault: false,
        saaModifiedOn: new Date(),
        saaModifiedBy: DEFAULT_ACTOR,
      },
    });
  }

  private applyOptionalFields(
    data: Prisma.AccShipAddrUncheckedCreateInput | Prisma.AccShipAddrUncheckedUpdateInput,
    saveLedgerShippingAddressDto: SaveLedgerShippingAddressDto,
  ): void {
    if (this.hasOwnProperty(saveLedgerShippingAddressDto, 'saaCompanyId')) {
      data.saaCompanyId = saveLedgerShippingAddressDto.saaCompanyId;
    }

    if (this.hasOwnProperty(saveLedgerShippingAddressDto, 'saaIsDefault')) {
      data.saaIsDefault = saveLedgerShippingAddressDto.saaIsDefault;
    }

    if (this.hasOwnProperty(saveLedgerShippingAddressDto, 'saaSort')) {
      data.saaSort = saveLedgerShippingAddressDto.saaSort;
    }

    if (this.hasOwnProperty(saveLedgerShippingAddressDto, 'saaTrdnm')) {
      data.saaTrdnm = saveLedgerShippingAddressDto.saaTrdnm;
    }

    if (this.hasOwnProperty(saveLedgerShippingAddressDto, 'saaContactName')) {
      data.saaContactName = saveLedgerShippingAddressDto.saaContactName;
    }

    if (this.hasOwnProperty(saveLedgerShippingAddressDto, 'saaAddr1')) {
      data.saaAddr1 = saveLedgerShippingAddressDto.saaAddr1;
    }

    if (this.hasOwnProperty(saveLedgerShippingAddressDto, 'saaAddr2')) {
      data.saaAddr2 = saveLedgerShippingAddressDto.saaAddr2;
    }

    if (this.hasOwnProperty(saveLedgerShippingAddressDto, 'saaAddr3')) {
      data.saaAddr3 = saveLedgerShippingAddressDto.saaAddr3;
    }

    if (this.hasOwnProperty(saveLedgerShippingAddressDto, 'saaLoc')) {
      data.saaLoc = saveLedgerShippingAddressDto.saaLoc;
    }

    if (this.hasOwnProperty(saveLedgerShippingAddressDto, 'saaPin')) {
      data.saaPin = saveLedgerShippingAddressDto.saaPin;
    }

    if (this.hasOwnProperty(saveLedgerShippingAddressDto, 'saaStateCode')) {
      data.saaStateCode = saveLedgerShippingAddressDto.saaStateCode;
    }

    if (this.hasOwnProperty(saveLedgerShippingAddressDto, 'saaStateName')) {
      data.saaStateName = saveLedgerShippingAddressDto.saaStateName;
    }

    if (this.hasOwnProperty(saveLedgerShippingAddressDto, 'saaDistanceKm')) {
      data.saaDistanceKm = saveLedgerShippingAddressDto.saaDistanceKm;
    }

    if (this.hasOwnProperty(saveLedgerShippingAddressDto, 'saaPhone')) {
      data.saaPhone = saveLedgerShippingAddressDto.saaPhone;
    }

    if (this.hasOwnProperty(saveLedgerShippingAddressDto, 'saaEmail')) {
      data.saaEmail = saveLedgerShippingAddressDto.saaEmail;
    }

    if (this.hasOwnProperty(saveLedgerShippingAddressDto, 'saaGstin')) {
      data.saaGstin = saveLedgerShippingAddressDto.saaGstin;
    }

    if (this.hasOwnProperty(saveLedgerShippingAddressDto, 'saaPan')) {
      data.saaPan = saveLedgerShippingAddressDto.saaPan;
    }

    if (this.hasOwnProperty(saveLedgerShippingAddressDto, 'saaSyncDate')) {
      data.saaSyncDate = saveLedgerShippingAddressDto.saaSyncDate;
    }

    if (this.hasOwnProperty(saveLedgerShippingAddressDto, 'saaIsActive')) {
      data.saaIsActive = saveLedgerShippingAddressDto.saaIsActive;
    }

    if (this.hasOwnProperty(saveLedgerShippingAddressDto, 'saaRemarks')) {
      data.saaRemarks = saveLedgerShippingAddressDto.saaRemarks;
    }
  }

  private normalizeAddressType(value: string): string {
    const normalized = value.trim().toUpperCase();
    if (!normalized) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'saaAddrType',
          message: 'saaAddrType must not be empty',
        },
      ]);
    }

    return normalized;
  }

  private resolveDisplayName(
    record:
      | Pick<AccShipAddr, 'saaId' | 'saaTrdnm' | 'saaContactName'>
      | LedgerShippingAddressPayload,
  ): string {
    return record.saaTrdnm ?? record.saaContactName ?? record.saaId;
  }

  private toPayload(record: AccShipAddr): LedgerShippingAddressPayload {
    return {
      saaId: record.saaId,
      saaCompanyId: record.saaCompanyId,
      saaLedgerId: record.saaLedgerId,
      saaAddrType: record.saaAddrType,
      saaIsDefault: record.saaIsDefault,
      saaSort: record.saaSort,
      saaTrdnm: record.saaTrdnm,
      saaContactName: record.saaContactName,
      saaAddr1: record.saaAddr1,
      saaAddr2: record.saaAddr2,
      saaAddr3: record.saaAddr3,
      saaLoc: record.saaLoc,
      saaPin: record.saaPin,
      saaStateCode: record.saaStateCode,
      saaStateName: record.saaStateName,
      saaDistanceKm: record.saaDistanceKm,
      saaPhone: record.saaPhone,
      saaEmail: record.saaEmail,
      saaGstin: record.saaGstin,
      saaPan: record.saaPan,
      saaSyncDate: record.saaSyncDate ? record.saaSyncDate.toISOString() : null,
      saaIsActive: record.saaIsActive,
      saaIsDeleted: record.saaIsDeleted,
      saaCreatedOn: record.saaCreatedOn.toISOString(),
      saaCreatedBy: record.saaCreatedBy,
      saaModifiedOn: record.saaModifiedOn.toISOString(),
      saaModifiedBy: record.saaModifiedBy,
      saaRemarks: record.saaRemarks,
    };
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Ledger shipping address already exists', [
          {
            field: 'saaId',
            message: 'Duplicate ledger shipping address unique value is not allowed',
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

  private throwNotFound(saaId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Ledger shipping address not found', [
        {
          field: 'saaId',
          message: `No active ledger shipping address found with id ${saaId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: LedgerShippingAddressErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: LedgerShippingAddressErrorDetail[] = [],
  ): LedgerShippingAddressErrorResponse {
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
