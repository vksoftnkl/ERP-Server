import { Injectable } from '@nestjs/common';
import { AccShipAddr, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveLedgerShippingAddressDto } from './dto/save-ledger-shipping-address.dto';
import {
  LedgerShippingAddressErrorDetail,
  LedgerShippingAddressPayload,
} from './types/ledger-shipping-address-api.types';
import {
  DEFAULT_ACTOR,
  hasOwnProperty,
  throwAccountsBadRequest,
  throwAccountsConflict,
  throwAccountsNotFound,
  throwOnUniqueConstraintError,
} from 'src/common/utils/module-service.utils';
import type { AccountsWriteClient } from 'src/common/utils/module-service.utils';
const LEDGER_SHIPPING_ADDRESS_TABLE_NAME = 'acc ship addrs';
const LEDGER_SHIPPING_ADDRESS_AUDIT_SCREEN_NAME = 'Ledger Shipping Address';
const DEFAULT_ADDR_TYPE = 'SHIP_TO';
type LedgerShippingAddressWriteClient = AccountsWriteClient;

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

  async getById(saaId: string): Promise<LedgerShippingAddressPayload> {
    const record = await this.prisma.accShipAddr.findFirst({
      where: {
        saaId,
        saaIsDeleted: false,
      },
    });

    if (!record) {
      throwAccountsNotFound<LedgerShippingAddressErrorDetail>(
        'Ledger shipping address not found',
        'saaId',
        `No active ledger shipping address found with id ${saaId}`,
      );
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
        throwAccountsNotFound<LedgerShippingAddressErrorDetail>(
          'Ledger shipping address not found',
          'saaId',
          `No active ledger shipping address found with id ${saaId}`,
        );
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
        throwAccountsNotFound<LedgerShippingAddressErrorDetail>(
          'Ledger shipping address not found',
          'saaId',
          `No active ledger shipping address found with id ${saaId}`,
        );
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
          hasOwnProperty(saveLedgerShippingAddressDto, 'saaCompanyId') &&
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
      throwOnUniqueConstraintError<LedgerShippingAddressErrorDetail>(
        error,
        'Ledger shipping address already exists',
        [
          {
            field: 'saaId',
            message: 'Duplicate ledger shipping address unique value is not allowed',
          },
        ],
      );
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
          throwAccountsNotFound<LedgerShippingAddressErrorDetail>(
            'Ledger shipping address not found',
            'saaId',
            `No active ledger shipping address found with id ${saaId}`,
          );
        }

        const nextAddrType = this.normalizeAddressType(
          saveLedgerShippingAddressDto.saaAddrType ?? existing.saaAddrType,
        );
        const nextLedgerId = saveLedgerShippingAddressDto.saaLedgerId;
        const nextCompanyId = hasOwnProperty(saveLedgerShippingAddressDto, 'saaCompanyId')
          ? (saveLedgerShippingAddressDto.saaCompanyId ?? null)
          : existing.saaCompanyId;
        const nextIsDefault = hasOwnProperty(saveLedgerShippingAddressDto, 'saaIsDefault')
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
      throwOnUniqueConstraintError<LedgerShippingAddressErrorDetail>(
        error,
        'Ledger shipping address already exists',
        [
          {
            field: 'saaId',
            message: 'Duplicate ledger shipping address unique value is not allowed',
          },
        ],
      );
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
      throwAccountsBadRequest<LedgerShippingAddressErrorDetail>('Ledger does not exist', [
        {
          field: 'saaLedgerId',
          message: `No active ledger found with id ${ledgerId}`,
        },
      ]);
    }
  }

  private async ensureCompanyExists(
    companyId: string,
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
      throwAccountsBadRequest<LedgerShippingAddressErrorDetail>('Company does not exist', [
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
    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaCompanyId')) {
      data.saaCompanyId = saveLedgerShippingAddressDto.saaCompanyId;
    }

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaIsDefault')) {
      data.saaIsDefault = saveLedgerShippingAddressDto.saaIsDefault;
    }

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaSort')) {
      data.saaSort = saveLedgerShippingAddressDto.saaSort;
    }

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaTrdnm')) {
      data.saaTrdnm = saveLedgerShippingAddressDto.saaTrdnm;
    }

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaContactName')) {
      data.saaContactName = saveLedgerShippingAddressDto.saaContactName;
    }

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaAddr1')) {
      data.saaAddr1 = saveLedgerShippingAddressDto.saaAddr1;
    }

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaAddr2')) {
      data.saaAddr2 = saveLedgerShippingAddressDto.saaAddr2;
    }

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaAddr3')) {
      data.saaAddr3 = saveLedgerShippingAddressDto.saaAddr3;
    }

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaLoc')) {
      data.saaLoc = saveLedgerShippingAddressDto.saaLoc;
    }

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaPin')) {
      data.saaPin = saveLedgerShippingAddressDto.saaPin;
    }

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaStateCode')) {
      data.saaStateCode = saveLedgerShippingAddressDto.saaStateCode;
    }

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaStateName')) {
      data.saaStateName = saveLedgerShippingAddressDto.saaStateName;
    }

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaDistanceKm')) {
      data.saaDistanceKm = saveLedgerShippingAddressDto.saaDistanceKm;
    }

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaPhone')) {
      data.saaPhone = saveLedgerShippingAddressDto.saaPhone;
    }

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaEmail')) {
      data.saaEmail = saveLedgerShippingAddressDto.saaEmail;
    }

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaGstin')) {
      data.saaGstin = saveLedgerShippingAddressDto.saaGstin;
    }

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaPan')) {
      data.saaPan = saveLedgerShippingAddressDto.saaPan;
    }

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaSyncDate')) {
      data.saaSyncDate = saveLedgerShippingAddressDto.saaSyncDate;
    }

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaIsActive')) {
      data.saaIsActive = saveLedgerShippingAddressDto.saaIsActive;
    }

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaRemarks')) {
      data.saaRemarks = saveLedgerShippingAddressDto.saaRemarks;
    }
  }

  private normalizeAddressType(value: string): string {
    const normalized = value.trim().toUpperCase();
    if (!normalized) {
      throwAccountsBadRequest<LedgerShippingAddressErrorDetail>('Validation failed', [
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
}
