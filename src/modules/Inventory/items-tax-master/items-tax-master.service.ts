import { Injectable } from '@nestjs/common';
import { ItemTaxMaster, Prisma } from '@prisma/client';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from 'src/common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { ListItemTaxQueryDto } from './dto/list-item-tax-query.dto';
import { SaveItemTaxDto } from './dto/save-item-tax.dto';
import { ItemTaxErrorDetail, ItemTaxListItem, ItemTaxListMeta, ItemTaxPayload } from './types/item-tax-api.types';
import { resolvePagination, runConfiguredGridQuery, runInventoryListQuery } from 'src/common/utils/module-list.utils';
import {
  DEFAULT_ACTOR,
  hasOwnProperty,
  resolveActor,
  throwInventoryBadRequest,
  throwInventoryNotFound,
  throwOnUniqueConstraintError,
  toNumber,
} from 'src/common/utils/module-service.utils';
const ITEM_TAX_TABLE_NAME = 'item tax master';
const ITEM_TAX_AUDIT_SCREEN_NAME = 'Item Tax Master';
@Injectable()
export class ItemsTaxMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}
  async save(saveItemTaxDto: SaveItemTaxDto): Promise<ItemTaxPayload> {
    if (saveItemTaxDto.tax_id) {
      return this.updateItemTax(saveItemTaxDto);
    }
    return this.createItemTax(saveItemTaxDto);
  }
  async list(
    queryDto: ListItemTaxQueryDto,
  ): Promise<ConfiguredGridListResult<ItemTaxListItem, ItemTaxListMeta>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const hasStructuredFilters =
      queryDto.tax_is_active !== undefined ||
      queryDto.tax_taxability_type !== undefined ||
      queryDto.tax_is_reverse_charge !== undefined;
    const where = this.buildListWhere(queryDto);
    return runInventoryListQuery({ page, limit }, {
      hasStructuredFilters,
      configuredGridFn: () => runConfiguredGridQuery<ItemTaxListItem>(
        this.configuredGridSqlService,
        { tableName: ITEM_TAX_TABLE_NAME, alias: 'item_tax_grid', search: queryDto.search, page, limit, skip },
      ),
      countFn: () => this.prisma.itemTaxMaster.count({ where }),
      findManyFn: () => this.prisma.itemTaxMaster.findMany({
        where,
        orderBy: [{ taxName: 'asc' }, { taxId: 'asc' }],
        skip,
        take: limit,
      }),
      toItemFn: (record) => this.toPayload(record),
      loadStylesFn: () => this.configuredGridSqlService.loadPrimaryGridStyles(ITEM_TAX_TABLE_NAME),
    });
  }
  async getById(taxId: string): Promise<ItemTaxPayload> {
    const record = await this.prisma.itemTaxMaster.findFirst({
      where: { taxId, taxIsDeleted: false },
    });
    if (!record) {
      throwInventoryNotFound<ItemTaxErrorDetail>('Item tax not found', 'tax_id', `No active item tax found with id ${taxId}`);
    }
    return this.toPayload(record);
  }
  async softDelete(taxId: string): Promise<{ tax_id: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.itemTaxMaster.findFirst({
        where: { taxId, taxIsDeleted: false },
      });
      if (!existing) {
        throwInventoryNotFound<ItemTaxErrorDetail>('Item tax not found', 'tax_id', `No active item tax found with id ${taxId}`);
      }
      const modifiedOn = new Date();
      const result = await tx.itemTaxMaster.updateMany({
        where: { taxId, taxIsDeleted: false },
        data: { taxIsDeleted: true, taxModifiedOn: modifiedOn, taxModifiedBy: DEFAULT_ACTOR },
      });
      if (result.count === 0) {
        throwInventoryNotFound<ItemTaxErrorDetail>('Item tax not found', 'tax_id', `No active item tax found with id ${taxId}`);
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        taxIsDeleted: true,
        taxModifiedOn: modifiedOn,
        taxModifiedBy: DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: ITEM_TAX_TABLE_NAME,
          screenName: ITEM_TAX_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: taxId,
          displayName: existing.taxName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Item tax soft deleted',
        },
        tx,
      );
      return { tax_id: taxId, deleted: true };
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
    const createdBy = resolveActor(saveItemTaxDto.tax_created_by);
    const modifiedBy = resolveActor(saveItemTaxDto.tax_modified_by, createdBy);
    const data: Prisma.ItemTaxMasterUncheckedCreateInput = {
      taxName,
      taxCreatedOn: now,
      taxCreatedBy: createdBy,
      taxModifiedOn: now,
      taxModifiedBy: modifiedBy,
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
          throwInventoryNotFound<ItemTaxErrorDetail>('Item tax not found', 'tax_id', `No active item tax found with id ${taxId}`);
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
          taxModifiedBy: resolveActor(saveItemTaxDto.tax_modified_by),
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
            userId: payload.tax_modified_by ?? DEFAULT_ACTOR,
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
  private buildListWhere(queryDto: ListItemTaxQueryDto): Prisma.ItemTaxMasterWhereInput {
    const where: Prisma.ItemTaxMasterWhereInput = { taxIsDeleted: false };
    if (queryDto.tax_is_active !== undefined) where.taxIsActive = queryDto.tax_is_active;
    if (queryDto.tax_taxability_type?.trim()) {
      where.taxTaxabilityType = { equals: queryDto.tax_taxability_type.trim(), mode: 'insensitive' };
    }
    if (queryDto.tax_is_reverse_charge !== undefined) where.taxIsReverseCharge = queryDto.tax_is_reverse_charge;
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { taxName: { contains: search, mode: 'insensitive' } },
        { taxCode: { contains: search, mode: 'insensitive' } },
        { taxTaxabilityType: { contains: search, mode: 'insensitive' } },
        { taxCessType: { contains: search, mode: 'insensitive' } },
      ];
    }
    return where;
  }
  private applyOptionalFields(
    data: Prisma.ItemTaxMasterUncheckedCreateInput | Prisma.ItemTaxMasterUncheckedUpdateInput,
    saveItemTaxDto: SaveItemTaxDto,
  ): void {
    if (hasOwnProperty(saveItemTaxDto, 'tax_code')) data.taxCode = saveItemTaxDto.tax_code;
    if (hasOwnProperty(saveItemTaxDto, 'tax_taxability_type')) data.taxTaxabilityType = saveItemTaxDto.tax_taxability_type;
    if (hasOwnProperty(saveItemTaxDto, 'tax_is_reverse_charge')) data.taxIsReverseCharge = saveItemTaxDto.tax_is_reverse_charge;
    if (hasOwnProperty(saveItemTaxDto, 'tax_cgst_perc')) data.taxCgstPerc = saveItemTaxDto.tax_cgst_perc;
    if (hasOwnProperty(saveItemTaxDto, 'tax_sgst_perc')) data.taxSgstPerc = saveItemTaxDto.tax_sgst_perc;
    if (hasOwnProperty(saveItemTaxDto, 'tax_igst_perc')) data.taxIgstPerc = saveItemTaxDto.tax_igst_perc;
    if (hasOwnProperty(saveItemTaxDto, 'tax_cgst_pur_perc')) data.taxCgstPurPerc = saveItemTaxDto.tax_cgst_pur_perc;
    if (hasOwnProperty(saveItemTaxDto, 'tax_sgst_pur_perc')) data.taxSgstPurPerc = saveItemTaxDto.tax_sgst_pur_perc;
    if (hasOwnProperty(saveItemTaxDto, 'tax_igst_pur_perc')) data.taxIgstPurPerc = saveItemTaxDto.tax_igst_pur_perc;
    if (hasOwnProperty(saveItemTaxDto, 'tax_cess_type')) data.taxCessType = saveItemTaxDto.tax_cess_type;
    if (hasOwnProperty(saveItemTaxDto, 'tax_cess_perc')) data.taxCessPerc = saveItemTaxDto.tax_cess_perc;
    if (hasOwnProperty(saveItemTaxDto, 'tax_cess_unit')) data.taxCessUnit = saveItemTaxDto.tax_cess_unit;
    if (hasOwnProperty(saveItemTaxDto, 'tax_cess_pur_perc')) data.taxCessPurPerc = saveItemTaxDto.tax_cess_pur_perc;
    if (hasOwnProperty(saveItemTaxDto, 'tax_cess_pur_unit')) data.taxCessPurUnit = saveItemTaxDto.tax_cess_pur_unit;
    if (hasOwnProperty(saveItemTaxDto, 'tax_gst_rate_total')) data.taxGstRateTotal = saveItemTaxDto.tax_gst_rate_total;
    if (hasOwnProperty(saveItemTaxDto, 'tax_sales_ledger_id')) data.taxSalesLedgerId = saveItemTaxDto.tax_sales_ledger_id;
    if (hasOwnProperty(saveItemTaxDto, 'tax_sales_return_ledger_id')) data.taxSalesReturnLedgerId = saveItemTaxDto.tax_sales_return_ledger_id;
    if (hasOwnProperty(saveItemTaxDto, 'tax_purchase_ledger_id')) data.taxPurchaseLedgerId = saveItemTaxDto.tax_purchase_ledger_id;
    if (hasOwnProperty(saveItemTaxDto, 'tax_purchase_return_ledger_id')) data.taxPurchaseReturnLedgerId = saveItemTaxDto.tax_purchase_return_ledger_id;
    if (hasOwnProperty(saveItemTaxDto, 'tax_cgst_output_ledger_id')) data.taxCgstOutputLedgerId = saveItemTaxDto.tax_cgst_output_ledger_id;
    if (hasOwnProperty(saveItemTaxDto, 'tax_sgst_output_ledger_id')) data.taxSgstOutputLedgerId = saveItemTaxDto.tax_sgst_output_ledger_id;
    if (hasOwnProperty(saveItemTaxDto, 'tax_igst_output_ledger_id')) data.taxIgstOutputLedgerId = saveItemTaxDto.tax_igst_output_ledger_id;
    if (hasOwnProperty(saveItemTaxDto, 'tax_cess_output_ledger_id')) data.taxCessOutputLedgerId = saveItemTaxDto.tax_cess_output_ledger_id;
    if (hasOwnProperty(saveItemTaxDto, 'tax_cgst_input_ledger_id')) data.taxCgstInputLedgerId = saveItemTaxDto.tax_cgst_input_ledger_id;
    if (hasOwnProperty(saveItemTaxDto, 'tax_sgst_input_ledger_id')) data.taxSgstInputLedgerId = saveItemTaxDto.tax_sgst_input_ledger_id;
    if (hasOwnProperty(saveItemTaxDto, 'tax_igst_input_ledger_id')) data.taxIgstInputLedgerId = saveItemTaxDto.tax_igst_input_ledger_id;
    if (hasOwnProperty(saveItemTaxDto, 'tax_cess_input_ledger_id')) data.taxCessInputLedgerId = saveItemTaxDto.tax_cess_input_ledger_id;
    if (hasOwnProperty(saveItemTaxDto, 'tax_is_active')) data.taxIsActive = saveItemTaxDto.tax_is_active;
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