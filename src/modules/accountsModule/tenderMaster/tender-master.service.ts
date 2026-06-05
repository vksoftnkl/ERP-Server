import { Injectable } from '@nestjs/common';
import { AccountTenderMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveTenderMasterDto } from './dto/save-tender-master.dto';
import { TenderMasterErrorDetail, TenderMasterPayload } from './types/tender-master-api.types';
import {
  DEFAULT_ACTOR,
  hasOwnProperty,
  normalizeRequiredText,
  throwAccountsBadRequest,
  throwAccountsConflict,
  throwAccountsNotFound,
  throwOnUniqueConstraintError,
} from 'src/common/utils/module-service.utils';
import type { AccountsWriteClient } from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
const TENDER_MASTER_TABLE_NAME = 'account tender master';
const TENDER_MASTER_AUDIT_SCREEN_NAME = 'Tender Master';
type TenderMasterWriteClient = AccountsWriteClient;

@Injectable()
export class TenderMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async save(saveTenderMasterDto: SaveTenderMasterDto): Promise<TenderMasterPayload> {
    if (saveTenderMasterDto.tndId) {
      return this.updateTender(saveTenderMasterDto);
    }

    return this.createTender(saveTenderMasterDto);
  }

  async getById(tndId: string): Promise<TenderMasterPayload> {
    const record = await this.prisma.accountTenderMaster.findFirst({
      where: {
        acctndId: tndId,
        acctndIsDeleted: false,
      },
    });

    if (!record) {
      throwAccountsNotFound<TenderMasterErrorDetail>(
        'Tender not found',
        'tndId',
        `No active tender found with id ${tndId}`,
      );
    }

    return this.toPayload(record);
  }

  async softDelete(tndId: string): Promise<{ tndId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.accountTenderMaster.findFirst({
        where: {
          acctndId: tndId,
          acctndIsDeleted: false,
        },
      });

      if (!existing) {
        throwAccountsNotFound<TenderMasterErrorDetail>(
          'Tender not found',
          'tndId',
          `No active tender found with id ${tndId}`,
        );
      }

      const modifiedOn = new Date();
      const result = await tx.accountTenderMaster.updateMany({
        where: {
          acctndId: tndId,
          acctndIsDeleted: false,
        },
        data: {
          acctndIsDeleted: true,
          acctndIsActive: false,
          acctndModifiedOn: modifiedOn,
          acctndModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        throwAccountsNotFound<TenderMasterErrorDetail>(
          'Tender not found',
          'tndId',
          `No active tender found with id ${tndId}`,
        );
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        acctndIsDeleted: true,
        acctndIsActive: false,
        acctndModifiedOn: modifiedOn,
        acctndModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: TENDER_MASTER_TABLE_NAME,
          screenName: TENDER_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: tndId,
          displayName: existing.acctndName,
          originalRecord,
          modifiedRecord,
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
          notes: 'Tender soft deleted',
        },
        tx,
      );

      return {
        tndId,
        deleted: true,
      };
    });
  }

  private async createTender(
    saveTenderMasterDto: SaveTenderMasterDto,
  ): Promise<TenderMasterPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const tndName = normalizeRequiredText<TenderMasterErrorDetail>(
          saveTenderMasterDto.tndName,
          'tndName',
        );
        const tndTypeId = this.parseTenderTypeId(saveTenderMasterDto.tndTypeId, 'tndTypeId');
        const tndRemarks = this.normalizeNullableString(saveTenderMasterDto.tndRemarks);
        const tndMinAmount = this.toInputNumber(saveTenderMasterDto.tndMinAmount, 'tndMinAmount');
        const tndMaxAmount = this.toInputNullableNumber(
          saveTenderMasterDto.tndMaxAmount,
          'tndMaxAmount',
        );
        const tndSurchargePerc = this.toInputNullableNumber(
          saveTenderMasterDto.tndSurchargePerc,
          'tndSurchargePerc',
        );
        this.validateAmountRange(tndMinAmount, tndMaxAmount);

        await this.ensureTenderTypeExists(tndTypeId, tx);
        await this.ensureLedgerExists(saveTenderMasterDto.tndLedgerId, tx);
        await this.ensureNameIsUnique(tx, tndName, tndTypeId);

        const now = new Date();
        const data: Prisma.AccountTenderMasterUncheckedCreateInput = {
          acctndTypeId: tndTypeId,
          acctndName: tndName,
          acctndShortName: this.buildShortName(tndName),
          acctndLedgerId: saveTenderMasterDto.tndLedgerId,
          acctndMinAmount: tndMinAmount,
          acctndCreatedOn: now,
          acctndCreatedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        };

        if (hasOwnProperty(saveTenderMasterDto, 'tndMaxAmount')) {
          data.acctndMaxAmount = tndMaxAmount;
        }

        if (
          hasOwnProperty(saveTenderMasterDto, 'tndDisplayPosition') &&
          saveTenderMasterDto.tndDisplayPosition !== undefined
        ) {
          data.acctndDisplayPosition = saveTenderMasterDto.tndDisplayPosition;
        }

        if (
          hasOwnProperty(saveTenderMasterDto, 'tndSurchargePerc') &&
          tndSurchargePerc !== undefined &&
          tndSurchargePerc !== null
        ) {
          data.acctndSurchargePerc = tndSurchargePerc;
        }

        if (hasOwnProperty(saveTenderMasterDto, 'tndIsActive')) {
          data.acctndIsActive = saveTenderMasterDto.tndIsActive;
        }

        if (hasOwnProperty(saveTenderMasterDto, 'tndRemarks')) {
          data.acctndRemarks = tndRemarks;
        }

        if (hasOwnProperty(saveTenderMasterDto, 'tndEditSurcharge')) {
          data.acctndEditSurcharge = saveTenderMasterDto.tndEditSurcharge;
        }

        if (hasOwnProperty(saveTenderMasterDto, 'tndEditLedger')) {
          data.acctndEditLedger = saveTenderMasterDto.tndEditLedger;
        }

        const created = await tx.accountTenderMaster.create({ data });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: TENDER_MASTER_TABLE_NAME,
            screenName: TENDER_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.tndId,
            displayName: payload.tndName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Tender created',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<TenderMasterErrorDetail>(error, 'Tender already exists', [
        { field: 'tndName', message: 'Duplicate tender unique value is not allowed' },
      ]);
      throw error;
    }
  }

  private async updateTender(
    saveTenderMasterDto: SaveTenderMasterDto,
  ): Promise<TenderMasterPayload> {
    const tndId = saveTenderMasterDto.tndId!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.accountTenderMaster.findFirst({
          where: {
            acctndId: tndId,
            acctndIsDeleted: false,
          },
        });

        if (!existing) {
          throwAccountsNotFound<TenderMasterErrorDetail>(
            'Tender not found',
            'tndId',
            `No active tender found with id ${tndId}`,
          );
        }

        const tndName = normalizeRequiredText<TenderMasterErrorDetail>(
          saveTenderMasterDto.tndName,
          'tndName',
        );
        const tndTypeId = this.parseTenderTypeId(saveTenderMasterDto.tndTypeId, 'tndTypeId');
        const tndRemarks = this.normalizeNullableString(saveTenderMasterDto.tndRemarks);
        const tndMinAmount = this.toInputNumber(saveTenderMasterDto.tndMinAmount, 'tndMinAmount');
        const tndMaxAmount = this.toInputNullableNumber(
          saveTenderMasterDto.tndMaxAmount,
          'tndMaxAmount',
        );
        const tndSurchargePerc = this.toInputNullableNumber(
          saveTenderMasterDto.tndSurchargePerc,
          'tndSurchargePerc',
        );
        this.validateAmountRange(tndMinAmount, tndMaxAmount);

        await this.ensureTenderTypeExists(tndTypeId, tx);
        await this.ensureLedgerExists(saveTenderMasterDto.tndLedgerId, tx);
        await this.ensureNameIsUnique(tx, tndName, tndTypeId, tndId);

        const data: Prisma.AccountTenderMasterUncheckedUpdateInput = {
          acctndTypeId: tndTypeId,
          acctndName: tndName,
          acctndShortName: this.buildShortName(tndName),
          acctndLedgerId: saveTenderMasterDto.tndLedgerId,
          acctndMinAmount: tndMinAmount,
          acctndModifiedOn: new Date(),
          acctndModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        };

        if (hasOwnProperty(saveTenderMasterDto, 'tndMaxAmount')) {
          data.acctndMaxAmount = tndMaxAmount;
        }

        if (
          hasOwnProperty(saveTenderMasterDto, 'tndDisplayPosition') &&
          saveTenderMasterDto.tndDisplayPosition !== undefined
        ) {
          data.acctndDisplayPosition = saveTenderMasterDto.tndDisplayPosition;
        }

        if (
          hasOwnProperty(saveTenderMasterDto, 'tndSurchargePerc') &&
          tndSurchargePerc !== undefined &&
          tndSurchargePerc !== null
        ) {
          data.acctndSurchargePerc = tndSurchargePerc;
        }

        if (hasOwnProperty(saveTenderMasterDto, 'tndIsActive')) {
          data.acctndIsActive = saveTenderMasterDto.tndIsActive;
        }

        if (hasOwnProperty(saveTenderMasterDto, 'tndRemarks')) {
          data.acctndRemarks = tndRemarks;
        }

        if (hasOwnProperty(saveTenderMasterDto, 'tndEditSurcharge')) {
          data.acctndEditSurcharge = saveTenderMasterDto.tndEditSurcharge;
        }

        if (hasOwnProperty(saveTenderMasterDto, 'tndEditLedger')) {
          data.acctndEditLedger = saveTenderMasterDto.tndEditLedger;
        }

        const updated = await tx.accountTenderMaster.update({
          where: {
            acctndId: tndId,
          },
          data,
        });
        const payload = this.toPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: TENDER_MASTER_TABLE_NAME,
            screenName: TENDER_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: tndId,
            displayName: payload.tndName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Tender updated',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<TenderMasterErrorDetail>(error, 'Tender already exists', [
        { field: 'tndName', message: 'Duplicate tender unique value is not allowed' },
      ]);
      throw error;
    }
  }

  private async ensureTenderTypeExists(typeId: bigint, tx: TenderMasterWriteClient): Promise<void> {
    const tenderType = await tx.accountTenderTypes.findFirst({
      where: {
        accttTypeId: typeId,
        accttTypeIsDeleted: false,
      },
      select: {
        accttTypeId: true,
      },
    });

    if (!tenderType) {
      throwAccountsBadRequest<TenderMasterErrorDetail>('Tender type does not exist', [
        {
          field: 'tndTypeId',
          message: `No active tender type found with id ${typeId.toString()}`,
        },
      ]);
    }
  }

  private async ensureLedgerExists(ledgerId: string, tx: TenderMasterWriteClient): Promise<void> {
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
      throwAccountsBadRequest<TenderMasterErrorDetail>('Ledger does not exist', [
        {
          field: 'tndLedgerId',
          message: `No active account ledger found with id ${ledgerId}`,
        },
      ]);
    }
  }

  private async ensureNameIsUnique(
    tx: TenderMasterWriteClient,
    tndName: string,
    tndTypeId: bigint,
    excludeTndId?: string,
  ): Promise<void> {
    const existing = await tx.accountTenderMaster.findFirst({
      where: {
        acctndIsDeleted: false,
        acctndTypeId: tndTypeId,
        acctndName: {
          equals: tndName,
          mode: 'insensitive',
        },
        ...(excludeTndId
          ? {
              acctndId: {
                not: excludeTndId,
              },
            }
          : {}),
      },
      select: {
        acctndId: true,
      },
    });

    if (existing) {
      throwAccountsConflict<TenderMasterErrorDetail>(
        'Tender name already exists for this tender type',
        [{ field: 'tndName', message: 'Duplicate tndName is not allowed for this tender type' }],
      );
    }
  }

  private validateAmountRange(tndMinAmount: number, tndMaxAmount: number | null | undefined): void {
    if (tndMaxAmount === null || tndMaxAmount === undefined) {
      return;
    }

    if (tndMaxAmount < tndMinAmount) {
      throwAccountsBadRequest<TenderMasterErrorDetail>('Validation failed', [
        {
          field: 'tndMaxAmount',
          message: 'tndMaxAmount must be greater than or equal to tndMinAmount',
        },
      ]);
    }
  }

  private parseTenderTypeId(value: string, field: string): bigint {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
      throwAccountsBadRequest<TenderMasterErrorDetail>('Validation failed', [
        {
          field,
          message: `${field} must be a valid numeric identifier`,
        },
      ]);
    }

    return BigInt(normalized);
  }

  private normalizeNullableString(value: string | null | undefined): string | null | undefined {
    if (value === undefined || value === null) {
      return value;
    }

    const trimmed = value.trim();
    return trimmed || null;
  }

  private toInputNumber(value: number, field: string): number {
    if (!Number.isFinite(value)) {
      throwAccountsBadRequest<TenderMasterErrorDetail>('Validation failed', [
        {
          field,
          message: `${field} must be a finite number`,
        },
      ]);
    }

    return value;
  }

  private toInputNullableNumber(
    value: number | null | undefined,
    field: string,
  ): number | null | undefined {
    if (value === null || value === undefined) {
      return value;
    }

    return this.toInputNumber(value, field);
  }

  private buildShortName(value: string): string {
    return value;
  }

  private toOutputNumber(value: Prisma.Decimal | number): number {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value.toString());
  }

  private toOutputNullableNumber(value: Prisma.Decimal | number | null): number | null {
    return value === null ? null : this.toOutputNumber(value);
  }

  private toPayload(record: AccountTenderMaster): TenderMasterPayload {
    return {
      tndId: record.acctndId,
      tndTypeId: record.acctndTypeId.toString(),
      tndName: record.acctndName,
      tndLedgerId: record.acctndLedgerId,
      tndMinAmount: this.toOutputNumber(record.acctndMinAmount),
      tndMaxAmount: this.toOutputNullableNumber(record.acctndMaxAmount),
      tndDisplayPosition: record.acctndDisplayPosition,
      tndSurchargePerc: this.toOutputNumber(record.acctndSurchargePerc),
      tndIsActive: record.acctndIsActive,
      tndIsDeleted: record.acctndIsDeleted,
      tndRemarks: record.acctndRemarks,
      tndEditSurcharge: record.acctndEditSurcharge,
      tndEditLedger: record.acctndEditLedger,
      tndSyncDate: record.acctndSyncDate ? record.acctndSyncDate.toISOString() : null,
      tndCreatedOn: record.acctndCreatedOn.toISOString(),
      tndCreatedBy: record.acctndCreatedBy,
      tndModifiedOn: record.acctndModifiedOn.toISOString(),
      tndModifiedBy: record.acctndModifiedBy,
    };
  }
}
