import { Injectable } from '@nestjs/common';
import { ItemTaxMaster, Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { SaveItemTaxDto } from './dto/save-item-tax.dto';
import { ItemTaxErrorDetail, ItemTaxPayload } from './types/item-tax-api.types';
import {
  DEFAULT_ACTOR,
  hasOwnProperty,
  resolveActor,
  throwInventoryBadRequest,
  throwInventoryNotFound,
  throwOnUniqueConstraintError,
  toNumber,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
const ITEM_TAX_TABLE_NAME = 'item tax master';
const ITEM_TAX_AUDIT_SCREEN_NAME = 'Item Tax Master';
@Injectable()
export class ItemsTaxMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(saveItemTaxDto: SaveItemTaxDto): Promise<ItemTaxPayload> {
    if (saveItemTaxDto.tax_id) {
      return this.updateItemTax(saveItemTaxDto);
    }
    return this.createItemTax(saveItemTaxDto);
  }
  async getById(taxId: string): Promise<ItemTaxPayload> {
    const record = await this.prisma.itemTaxMaster.findFirst({
      where: { taxId, taxIsDeleted: false },
    });
    if (!record) {
      throwInventoryNotFound<ItemTaxErrorDetail>(
        'Item tax not found',
        'tax_id',
        `No active item tax found with id ${taxId}`,
      );
    }
    const payload = this.toPayload(record);
    const ledgerNames = await this.loadLedgerNameMap(record);
    payload.tax_sales_ledger_name = this.ledgerName(ledgerNames, record.taxSalesLedgerId);
    payload.tax_sales_return_ledger_name = this.ledgerName(ledgerNames, record.taxSalesReturnLedgerId);
    payload.tax_purchase_ledger_name = this.ledgerName(ledgerNames, record.taxPurchaseLedgerId);
    payload.tax_purchase_return_ledger_name = this.ledgerName(
      ledgerNames,
      record.taxPurchaseReturnLedgerId,
    );
    payload.tax_cgst_output_ledger_name = this.ledgerName(ledgerNames, record.taxCgstOutputLedgerId);
    payload.tax_sgst_output_ledger_name = this.ledgerName(ledgerNames, record.taxSgstOutputLedgerId);
    payload.tax_igst_output_ledger_name = this.ledgerName(ledgerNames, record.taxIgstOutputLedgerId);
    payload.tax_cess_output_ledger_name = this.ledgerName(ledgerNames, record.taxCessOutputLedgerId);
    payload.tax_cgst_input_ledger_name = this.ledgerName(ledgerNames, record.taxCgstInputLedgerId);
    payload.tax_sgst_input_ledger_name = this.ledgerName(ledgerNames, record.taxSgstInputLedgerId);
    payload.tax_igst_input_ledger_name = this.ledgerName(ledgerNames, record.taxIgstInputLedgerId);
    payload.tax_cess_input_ledger_name = this.ledgerName(ledgerNames, record.taxCessInputLedgerId);
    return payload;
  }

  private async loadLedgerNameMap(record: ItemTaxMaster): Promise<Map<string, string>> {
    const ids = [
      record.taxSalesLedgerId,
      record.taxSalesReturnLedgerId,
      record.taxPurchaseLedgerId,
      record.taxPurchaseReturnLedgerId,
      record.taxCgstOutputLedgerId,
      record.taxSgstOutputLedgerId,
      record.taxIgstOutputLedgerId,
      record.taxCessOutputLedgerId,
      record.taxCgstInputLedgerId,
      record.taxSgstInputLedgerId,
      record.taxIgstInputLedgerId,
      record.taxCessInputLedgerId,
    ].filter((id): id is string => Boolean(id));

    if (ids.length === 0) {
      return new Map();
    }

    const ledgers = await this.prisma.accLedgerMaster.findMany({
      where: { ledId: { in: [...new Set(ids)] } },
      select: { ledId: true, ledName: true },
    });
    return new Map(ledgers.map((ledger) => [ledger.ledId, ledger.ledName]));
  }

  private ledgerName(nameById: Map<string, string>, ledgerId: string | null): string | null {
    return ledgerId ? (nameById.get(ledgerId) ?? null) : null;
  }
  async toggleDelete(taxId: string): Promise<{ tax_id: string; deleted: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      // Find regardless of current deleted state
      const existing = await tx.itemTaxMaster.findFirst({
        where: { taxId },
      });
      if (!existing) {
        throwInventoryNotFound<ItemTaxErrorDetail>(
          'Item tax not found',
          'tax_id',
          `No item tax found with id ${taxId}`,
        );
      }
      const wasDeleted = existing.taxIsDeleted;
      const nextDeleted = !wasDeleted;
      const modifiedOn = new Date();
      const userId = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      // Guarded update: only flips if state hasn't changed since the read
      const result = await tx.itemTaxMaster.updateMany({
        where: { taxId, taxIsDeleted: wasDeleted },
        data: { taxIsDeleted: nextDeleted, taxModifiedOn: modifiedOn, taxModifiedBy: userId },
      });
      if (result.count === 0) {
        throwInventoryNotFound<ItemTaxErrorDetail>(
          'Item tax not found',
          'tax_id',
          `No item tax found with id ${taxId}`,
        );
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        taxIsDeleted: nextDeleted,
        taxModifiedOn: modifiedOn,
        taxModifiedBy: userId,
      });
      await this.auditLogService.logEntityChange(
        {
          action: nextDeleted ? 'cancel' : 'update',
          tableName: ITEM_TAX_TABLE_NAME,
          screenName: ITEM_TAX_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: taxId,
          displayName: existing.taxName,
          originalRecord,
          modifiedRecord,
          userId,
          notes: nextDeleted ? 'Item tax soft deleted' : 'Item tax restored',
        },
        tx,
      );
      return { tax_id: taxId, deleted: nextDeleted };
    });
  }
  private async createItemTax(saveItemTaxDto: SaveItemTaxDto): Promise<ItemTaxPayload> {
    const taxName = saveItemTaxDto.tax_name?.trim();
    if (!taxName) {
      throwInventoryBadRequest<ItemTaxErrorDetail>('Validation failed', [
        { field: 'tax_name', message: 'tax_name is required' },
      ]);
    }
    const now = new Date();
    const createdBy = resolveActor(saveItemTaxDto.tax_created_by, this.requestContextService.getUserId());
    const modifiedBy = resolveActor(saveItemTaxDto.tax_modified_by, createdBy);
    const data: Prisma.ItemTaxMasterUncheckedCreateInput = {
      taxName,
      taxCreatedOn: now,
      taxCreatedBy: createdBy,
    };
    this.applyOptionalFields(data, saveItemTaxDto);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.itemTaxMaster.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: ITEM_TAX_TABLE_NAME,
            screenName: ITEM_TAX_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.tax_id,
            displayName: payload.tax_name,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Item tax created',
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
  private async updateItemTax(saveItemTaxDto: SaveItemTaxDto): Promise<ItemTaxPayload> {
    const taxId = saveItemTaxDto.tax_id!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.itemTaxMaster.findFirst({
          where: { taxId, taxIsDeleted: false },
        });
        if (!existing) {
          throwInventoryNotFound<ItemTaxErrorDetail>(
            'Item tax not found',
            'tax_id',
            `No active item tax found with id ${taxId}`,
          );
        }
        const taxName = saveItemTaxDto.tax_name?.trim();
        if (!taxName) {
          throwInventoryBadRequest<ItemTaxErrorDetail>('Validation failed', [
            { field: 'tax_name', message: 'tax_name cannot be empty' },
          ]);
        }
        const data: Prisma.ItemTaxMasterUncheckedUpdateInput = {
          taxName,
          taxModifiedOn: new Date(),
          taxModifiedBy: resolveActor(saveItemTaxDto.tax_modified_by, this.requestContextService.getUserId()),
        };
        this.applyOptionalFields(data, saveItemTaxDto);
        const updated = await tx.itemTaxMaster.update({ where: { taxId }, data });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: ITEM_TAX_TABLE_NAME,
            screenName: ITEM_TAX_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: taxId,
            displayName: payload.tax_name,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.tax_modified_by ?? this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Item tax updated',
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
  private applyOptionalFields(
    data: Prisma.ItemTaxMasterUncheckedCreateInput | Prisma.ItemTaxMasterUncheckedUpdateInput,
    saveItemTaxDto: SaveItemTaxDto,
  ): void {
    if (hasOwnProperty(saveItemTaxDto, 'tax_code')) data.taxCode = saveItemTaxDto.tax_code;
    if (hasOwnProperty(saveItemTaxDto, 'tax_taxability_type'))
      data.taxTaxabilityType = saveItemTaxDto.tax_taxability_type;
    if (hasOwnProperty(saveItemTaxDto, 'tax_is_reverse_charge'))
      data.taxIsReverseCharge = saveItemTaxDto.tax_is_reverse_charge;
    if (hasOwnProperty(saveItemTaxDto, 'tax_cgst_perc'))
      data.taxCgstPerc = saveItemTaxDto.tax_cgst_perc;
    if (hasOwnProperty(saveItemTaxDto, 'tax_sgst_perc'))
      data.taxSgstPerc = saveItemTaxDto.tax_sgst_perc;
    if (hasOwnProperty(saveItemTaxDto, 'tax_igst_perc'))
      data.taxIgstPerc = saveItemTaxDto.tax_igst_perc;
    if (hasOwnProperty(saveItemTaxDto, 'tax_cgst_pur_perc'))
      data.taxCgstPurPerc = saveItemTaxDto.tax_cgst_pur_perc;
    if (hasOwnProperty(saveItemTaxDto, 'tax_sgst_pur_perc'))
      data.taxSgstPurPerc = saveItemTaxDto.tax_sgst_pur_perc;
    if (hasOwnProperty(saveItemTaxDto, 'tax_igst_pur_perc'))
      data.taxIgstPurPerc = saveItemTaxDto.tax_igst_pur_perc;
    if (hasOwnProperty(saveItemTaxDto, 'tax_cess_type'))
      data.taxCessType = saveItemTaxDto.tax_cess_type;
    if (hasOwnProperty(saveItemTaxDto, 'tax_cess_perc'))
      data.taxCessPerc = saveItemTaxDto.tax_cess_perc;
    if (hasOwnProperty(saveItemTaxDto, 'tax_cess_unit'))
      data.taxCessUnit = saveItemTaxDto.tax_cess_unit;
    if (hasOwnProperty(saveItemTaxDto, 'tax_cess_pur_perc'))
      data.taxCessPurPerc = saveItemTaxDto.tax_cess_pur_perc;
    if (hasOwnProperty(saveItemTaxDto, 'tax_cess_pur_unit'))
      data.taxCessPurUnit = saveItemTaxDto.tax_cess_pur_unit;
    if (hasOwnProperty(saveItemTaxDto, 'tax_gst_rate_total'))
      data.taxGstRateTotal = saveItemTaxDto.tax_gst_rate_total;
    if (hasOwnProperty(saveItemTaxDto, 'tax_sales_ledger_id'))
      data.taxSalesLedgerId = saveItemTaxDto.tax_sales_ledger_id;
    if (hasOwnProperty(saveItemTaxDto, 'tax_sales_return_ledger_id'))
      data.taxSalesReturnLedgerId = saveItemTaxDto.tax_sales_return_ledger_id;
    if (hasOwnProperty(saveItemTaxDto, 'tax_purchase_ledger_id'))
      data.taxPurchaseLedgerId = saveItemTaxDto.tax_purchase_ledger_id;
    if (hasOwnProperty(saveItemTaxDto, 'tax_purchase_return_ledger_id'))
      data.taxPurchaseReturnLedgerId = saveItemTaxDto.tax_purchase_return_ledger_id;
    if (hasOwnProperty(saveItemTaxDto, 'tax_cgst_output_ledger_id'))
      data.taxCgstOutputLedgerId = saveItemTaxDto.tax_cgst_output_ledger_id;
    if (hasOwnProperty(saveItemTaxDto, 'tax_sgst_output_ledger_id'))
      data.taxSgstOutputLedgerId = saveItemTaxDto.tax_sgst_output_ledger_id;
    if (hasOwnProperty(saveItemTaxDto, 'tax_igst_output_ledger_id'))
      data.taxIgstOutputLedgerId = saveItemTaxDto.tax_igst_output_ledger_id;
    if (hasOwnProperty(saveItemTaxDto, 'tax_cess_output_ledger_id'))
      data.taxCessOutputLedgerId = saveItemTaxDto.tax_cess_output_ledger_id;
    if (hasOwnProperty(saveItemTaxDto, 'tax_cgst_input_ledger_id'))
      data.taxCgstInputLedgerId = saveItemTaxDto.tax_cgst_input_ledger_id;
    if (hasOwnProperty(saveItemTaxDto, 'tax_sgst_input_ledger_id'))
      data.taxSgstInputLedgerId = saveItemTaxDto.tax_sgst_input_ledger_id;
    if (hasOwnProperty(saveItemTaxDto, 'tax_igst_input_ledger_id'))
      data.taxIgstInputLedgerId = saveItemTaxDto.tax_igst_input_ledger_id;
    if (hasOwnProperty(saveItemTaxDto, 'tax_cess_input_ledger_id'))
      data.taxCessInputLedgerId = saveItemTaxDto.tax_cess_input_ledger_id;
    if (hasOwnProperty(saveItemTaxDto, 'tax_is_active'))
      data.taxIsActive = saveItemTaxDto.tax_is_active;
  }
  private toPayload(record: ItemTaxMaster): ItemTaxPayload {
    return {
      tax_id: record.taxId,
      tax_name: record.taxName,
      tax_code: record.taxCode,
      tax_taxability_type: record.taxTaxabilityType,
      tax_is_reverse_charge: record.taxIsReverseCharge,
      tax_cgst_perc: toNumber(record.taxCgstPerc),
      tax_sgst_perc: toNumber(record.taxSgstPerc),
      tax_igst_perc: toNumber(record.taxIgstPerc),
      tax_cgst_pur_perc: toNumber(record.taxCgstPurPerc),
      tax_sgst_pur_perc: toNumber(record.taxSgstPurPerc),
      tax_igst_pur_perc: toNumber(record.taxIgstPurPerc),
      tax_cess_type: record.taxCessType,
      tax_cess_perc: toNumber(record.taxCessPerc),
      tax_cess_unit: toNumber(record.taxCessUnit),
      tax_cess_pur_perc: toNumber(record.taxCessPurPerc),
      tax_cess_pur_unit: toNumber(record.taxCessPurUnit),
      tax_gst_rate_total: toNumber(record.taxGstRateTotal),
      tax_sales_ledger_id: record.taxSalesLedgerId,
      tax_sales_return_ledger_id: record.taxSalesReturnLedgerId,
      tax_purchase_ledger_id: record.taxPurchaseLedgerId,
      tax_purchase_return_ledger_id: record.taxPurchaseReturnLedgerId,
      tax_cgst_output_ledger_id: record.taxCgstOutputLedgerId,
      tax_sgst_output_ledger_id: record.taxSgstOutputLedgerId,
      tax_igst_output_ledger_id: record.taxIgstOutputLedgerId,
      tax_cess_output_ledger_id: record.taxCessOutputLedgerId,
      tax_cgst_input_ledger_id: record.taxCgstInputLedgerId,
      tax_sgst_input_ledger_id: record.taxSgstInputLedgerId,
      tax_igst_input_ledger_id: record.taxIgstInputLedgerId,
      tax_cess_input_ledger_id: record.taxCessInputLedgerId,
      tax_is_active: record.taxIsActive,
      tax_is_deleted: record.taxIsDeleted,
      tax_sync_date: record.taxSyncDate ? record.taxSyncDate.toISOString() : null,
      tax_created_on: record.taxCreatedOn.toISOString(),
      tax_created_by: record.taxCreatedBy,
      tax_modified_on: record.taxModifiedOn.toISOString(),
      tax_modified_by: record.taxModifiedBy,
    };
  }
  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<ItemTaxErrorDetail>(error, 'Item tax name already exists', [
      { field: 'tax_name', message: 'Duplicate tax_name is not allowed' },
    ]);
  }
}
