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
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { SaaAddrType } from './types/ledger-shipping-address-enum';
import {
  DEFAULT_COUNTRY_CODE,
  assertSaaAddrType,
  assertSaaGstin,
  assertSaaPin,
  assertSaaStateCode,
} from './ledger-shipping-address.validation';
const LEDGER_SHIPPING_ADDRESS_TABLE_NAME = 'acc ship addrs';
const LEDGER_SHIPPING_ADDRESS_AUDIT_SCREEN_NAME = 'Ledger Shipping Address';
const DEFAULT_ADDR_TYPE = SaaAddrType.SHIP_TO;
type LedgerShippingAddressWriteClient = AccountsWriteClient;

@Injectable()
export class LedgerShippingAddressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
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
          saaModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
        saaModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
        const saaAddrType = assertSaaAddrType(
          saveLedgerShippingAddressDto.saaAddrType ?? DEFAULT_ADDR_TYPE,
        );
        const saaCountryCode = this.resolveCountryCode(saveLedgerShippingAddressDto.saaCountryCode);
        const saaGstin = assertSaaGstin(saveLedgerShippingAddressDto.saaGstin);
        assertSaaStateCode(saveLedgerShippingAddressDto.saaStateCode);
        assertSaaPin(saveLedgerShippingAddressDto.saaPin, saaCountryCode);

        await this.ensureLedgerExists(saveLedgerShippingAddressDto.saaLedgerId, tx);

        if (
          hasOwnProperty(saveLedgerShippingAddressDto, 'saaCompanyId') &&
          saveLedgerShippingAddressDto.saaCompanyId !== null &&
          saveLedgerShippingAddressDto.saaCompanyId !== undefined
        ) {
          await this.ensureCompanyExists(saveLedgerShippingAddressDto.saaCompanyId, tx);
        }

        if (
          hasOwnProperty(saveLedgerShippingAddressDto, 'saaBranchId') &&
          saveLedgerShippingAddressDto.saaBranchId !== null &&
          saveLedgerShippingAddressDto.saaBranchId !== undefined
        ) {
          await this.ensureBranchExists(saveLedgerShippingAddressDto.saaBranchId, tx);
        }

        if (saveLedgerShippingAddressDto.saaIsDefault === true) {
          await this.clearDefaultAddress(tx, saveLedgerShippingAddressDto.saaLedgerId, saaAddrType);
        }

        const now = new Date();
        const data: Prisma.AccShipAddrUncheckedCreateInput = {
          saaLedgerId: saveLedgerShippingAddressDto.saaLedgerId,
          saaAddrType,
          saaCountryCode,
          saaGstin,
          saaCreatedOn: now,
          saaCreatedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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

        const nextAddrType = assertSaaAddrType(
          saveLedgerShippingAddressDto.saaAddrType ?? existing.saaAddrType,
        );
        const nextLedgerId = saveLedgerShippingAddressDto.saaLedgerId;
        const nextCompanyId = hasOwnProperty(saveLedgerShippingAddressDto, 'saaCompanyId')
          ? (saveLedgerShippingAddressDto.saaCompanyId ?? null)
          : existing.saaCompanyId;
        const nextBranchId = hasOwnProperty(saveLedgerShippingAddressDto, 'saaBranchId')
          ? (saveLedgerShippingAddressDto.saaBranchId ?? null)
          : existing.saaBranchId;
        const nextCountryCode = this.resolveCountryCode(
          saveLedgerShippingAddressDto.saaCountryCode ?? existing.saaCountryCode,
        );
        const nextGstin = assertSaaGstin(saveLedgerShippingAddressDto.saaGstin);
        assertSaaStateCode(saveLedgerShippingAddressDto.saaStateCode);
        assertSaaPin(saveLedgerShippingAddressDto.saaPin, nextCountryCode);
        const nextIsDefault = hasOwnProperty(saveLedgerShippingAddressDto, 'saaIsDefault')
          ? (saveLedgerShippingAddressDto.saaIsDefault ?? false)
          : existing.saaIsDefault;

        await this.ensureLedgerExists(nextLedgerId, tx);

        if (nextCompanyId !== null) {
          await this.ensureCompanyExists(nextCompanyId, tx);
        }

        if (nextBranchId !== null) {
          await this.ensureBranchExists(nextBranchId, tx);
        }

        if (nextIsDefault) {
          await this.clearDefaultAddress(tx, nextLedgerId, nextAddrType, saaId);
        }

        const data: Prisma.AccShipAddrUncheckedUpdateInput = {
          saaLedgerId: nextLedgerId,
          saaAddrType: nextAddrType,
          saaCountryCode: nextCountryCode,
          saaGstin: nextGstin,
          saaModifiedOn: new Date(),
          saaModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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

  private async ensureBranchExists(
    branchId: string,
    tx: LedgerShippingAddressWriteClient,
  ): Promise<void> {
    const branch = await tx.branchMaster.findFirst({
      where: {
        brId: branchId,
        brIsDeleted: false,
      },
      select: {
        brId: true,
      },
    });

    if (!branch) {
      throwAccountsBadRequest<LedgerShippingAddressErrorDetail>('Branch does not exist', [
        {
          field: 'saaBranchId',
          message: `No active branch found with id ${branchId}`,
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
        saaModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaBranchId')) {
      data.saaBranchId = saveLedgerShippingAddressDto.saaBranchId;
    }

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaIsDefault')) {
      data.saaIsDefault = saveLedgerShippingAddressDto.saaIsDefault;
    }

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaSort')) {
      data.saaSort = saveLedgerShippingAddressDto.saaSort;
    }

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaTradeName')) {
      data.saaTradeName = saveLedgerShippingAddressDto.saaTradeName;
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

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaLocation')) {
      data.saaLocation = saveLedgerShippingAddressDto.saaLocation;
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

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaSyncedOn')) {
      data.saaSyncedOn = saveLedgerShippingAddressDto.saaSyncedOn;
    }

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaIsActive')) {
      data.saaIsActive = saveLedgerShippingAddressDto.saaIsActive;
    }

    if (hasOwnProperty(saveLedgerShippingAddressDto, 'saaRemarks')) {
      data.saaRemarks = saveLedgerShippingAddressDto.saaRemarks;
    }
  }

  private resolveCountryCode(value: string | null | undefined): string {
    const normalized = (value ?? DEFAULT_COUNTRY_CODE).trim().toUpperCase();
    return normalized || DEFAULT_COUNTRY_CODE;
  }

  private resolveDisplayName(
    record:
      | Pick<AccShipAddr, 'saaId' | 'saaTradeName' | 'saaContactName'>
      | LedgerShippingAddressPayload,
  ): string {
    return record.saaTradeName ?? record.saaContactName ?? record.saaId;
  }

  private toPayload(record: AccShipAddr): LedgerShippingAddressPayload {
    return {
      saaId: record.saaId,
      saaCompanyId: record.saaCompanyId,
      saaBranchId: record.saaBranchId,
      saaLedgerId: record.saaLedgerId,
      saaAddrType: record.saaAddrType,
      saaIsDefault: record.saaIsDefault,
      saaSort: record.saaSort,
      saaTradeName: record.saaTradeName,
      saaContactName: record.saaContactName,
      saaAddr1: record.saaAddr1,
      saaAddr2: record.saaAddr2,
      saaAddr3: record.saaAddr3,
      saaLocation: record.saaLocation,
      saaPin: record.saaPin,
      saaStateCode: record.saaStateCode,
      saaStateName: record.saaStateName,
      saaCountryCode: record.saaCountryCode,
      saaDistanceKm: record.saaDistanceKm,
      saaPhone: record.saaPhone,
      saaEmail: record.saaEmail,
      saaGstin: record.saaGstin,
      saaSyncedOn: record.saaSyncedOn ? record.saaSyncedOn.toISOString() : null,
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
