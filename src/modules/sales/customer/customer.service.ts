import { ConflictException, Injectable } from '@nestjs/common';
import { Customer, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AccountLedgerMastersService } from '../../accountsModule/accountLedgerMasters/account-ledger-masters.service';
import { SaveAccountLedgerMasterDto } from '../../accountsModule/accountLedgerMasters/dto/save-account-ledger-master.dto';
import { SaveCustomerDto } from './dto/save-customer.dto';
import {
  CustomerErrorDetail,
  CustomerErrorResponse,
  CustomerPayload,
} from './types/customer-api.types';
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
const CUSTOMER_TABLE_NAME = 'customers';
const CUSTOMER_AUDIT_SCREEN_NAME = 'Customer Master';
const CUSTOMER_OPTIONAL_FIELDS = [
  'cusTitle',
  'cusShort',
  'cusCode',
  'cusName',
  'cusAddr1',
  'cusAddr2',
  'cusAddr3',
  'cusCity',
  'cusDistrict',
  'cusCountry',
  'cusLandmark',
  'cusPin',
  'cusTel',
  'cusPhone1',
  'cusPhone2',
  'cusWhatsappNo',
  'cusEmail',
  'cusAadharNo',
  'cusContactPerson',
  'cusDistanceKm',
  'cusCreditAllowed',
  'cusCreditBillLimit',
  'cusCreditAmtLimit',
  'cusCreditDays',
  'cusDebitBalance',
  'cusDiscPerc',
  'cusDebitGraceDays',
  'cusEnableSms',
  'cusOverdueSms',
  'cusOverdueBilling',
  'cusAllowPromotion',
  'cusAllowLoyalty',
  'cusAllowDiscount',
  'cusSortOrder',
  'cusRegionName',
  'cusRegionAddr1',
  'cusRegionAddr2',
  'cusRegionAddr3',
  'cusRegionCity',
  'cusRegionDistrict',
  'cusRegionStateName',
  'cusRegionCountry',
  'cusBirthDate',
  'cusMarriageDate',
  'cusTransportName',
  'cusFreightCharge',
  'cusLoadingCharge',
  'cusUnloadingCharge',
  'cusGstNo',
  'cusPanNo',
  'cusGstType',
  'cusEcommerceGstin',
  'cusTcsApplicable',
  'cusItcollExempted',
  'cusItcollType',
  'cusGeoLocation',
  'cusCollectionDays',
  'cusDefaultSalesman',
  'cusNotes',
  'cusBranchId',
  'cusCompanyId',
  'cusIsActive',
];
// Customer field -> linked-ledger field copy map. Each entry is copied onto the
// ledger DTO only when the customer payload actually carries that key.
const CUSTOMER_TO_LEDGER_FIELD_MAP: ReadonlyArray<
  [keyof SaveCustomerDto, keyof SaveAccountLedgerMasterDto]
> = [
  ['cusCompanyId', 'ledCompanyId'],
  ['cusBranchId', 'ledBranchId'],
  ['cusShort', 'ledShort'],
  ['cusEmail', 'ledEmail'],
  ['cusTel', 'ledTel'],
  ['cusPhone1', 'ledPhone1'],
  ['cusPhone2', 'ledPhone2'],
  ['cusWhatsappNo', 'ledWhatsappNo'],
  ['cusContactPerson', 'ledContactPerson'],
  ['cusAddr1', 'ledAddr1'],
  ['cusAddr2', 'ledAddr2'],
  ['cusAddr3', 'ledAddr3'],
  ['cusCity', 'ledCity'],
  ['cusDistrict', 'ledDistrict'],
  ['cusPin', 'ledPin'],
  ['cusCountry', 'ledCountry'],
  ['cusRegionName', 'ledRegionName'],
  ['cusRegionAddr1', 'ledRegionAddr1'],
  ['cusRegionAddr2', 'ledRegionAddr2'],
  ['cusRegionAddr3', 'ledRegionAddr3'],
  ['cusRegionCity', 'ledRegionCity'],
  ['cusRegionDistrict', 'ledRegionDistrict'],
  ['cusRegionStateName', 'ledRegionStateName'],
  ['cusRegionCountry', 'ledRegionCountry'],
  ['cusGstNo', 'ledGstinNo'],
  ['cusPanNo', 'ledPanNo'],
  ['cusAadharNo', 'ledAadharNo'],
  ['cusEcommerceGstin', 'ledEcommerceGstin'],
  ['cusNotes', 'ledRemarks'],
  ['cusIsActive', 'ledIsActive'],
];
type CustomerWriteClient = SalesWriteClient;
@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
    private readonly accountLedgerMastersService: AccountLedgerMastersService,
  ) {}
  async save(saveCustomerDto: SaveCustomerDto): Promise<CustomerPayload> {
    if (saveCustomerDto.cusId) {
      return this.updateCustomer(saveCustomerDto);
    }
    return this.createCustomer(saveCustomerDto);
  }
  async getById(cusId: string): Promise<CustomerPayload> {
    const record = await this.prisma.customer.findFirst({
      where: {
        cusId,
        cusIsDeleted: false,
      },
    });
    if (!record) {
      throwSalesNotFound<CustomerErrorDetail, CustomerErrorResponse>(
        'Customer not found',
        'cusId',
        `No active customer found with id ${cusId}`,
      );
    }
    const payload = this.toPayload(record);
    const relatedNames = await this.resolveRelatedNames(this.prisma, record);
    return { ...payload, ...relatedNames };
  }
  async softDelete(cusId: string): Promise<{ cusId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.customer.findFirst({
        where: {
          cusId,
          cusIsDeleted: false,
        },
      });
      if (!existing) {
        throwSalesNotFound<CustomerErrorDetail, CustomerErrorResponse>(
          'Customer not found',
          'cusId',
          `No active customer found with id ${cusId}`,
        );
      }
      const modifiedOn = new Date();
      const result = await tx.customer.updateMany({
        where: {
          cusId,
          cusIsDeleted: false,
        },
        data: {
          cusIsDeleted: true,
          cusIsActive: false,
          cusModifiedOn: modifiedOn,
          cusModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        throwSalesNotFound<CustomerErrorDetail, CustomerErrorResponse>(
          'Customer not found',
          'cusId',
          `No active customer found with id ${cusId}`,
        );
      }
      // Soft delete the linked account ledger (shares cus_id as its PK) so it can't stay active
      // while the customer is logically deleted. No-op for legacy rows with no linked ledger.
      await tx.accLedgerMaster.updateMany({
        where: { ledId: cusId, ledIsDeleted: false },
        data: {
          ledIsDeleted: true,
          ledIsActive: false,
          ledModifiedOn: modifiedOn,
          ledModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        },
      });
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        cusIsDeleted: true,
        cusIsActive: false,
        cusModifiedOn: modifiedOn,
        cusModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: CUSTOMER_TABLE_NAME,
          screenName: CUSTOMER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: cusId,
          displayName: existing.cusName || cusId,
          originalRecord,
          modifiedRecord,
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
          notes: 'Customer soft deleted',
        },
        tx,
      );
      return {
        cusId,
        deleted: true,
      };
    });
  }
  private async createCustomer(saveCustomerDto: SaveCustomerDto): Promise<CustomerPayload> {
    // A name is required: it becomes both the customer name and the linked ledger's
    // ledName (which the account ledger master requires).
    const normalizedName = normalizeRequiredText<CustomerErrorDetail, CustomerErrorResponse>(
      saveCustomerDto.cusName ?? '',
      'cusName',
    );
    const normalizedStateName = normalizeRequiredText<CustomerErrorDetail, CustomerErrorResponse>(
      saveCustomerDto.cusStateName,
      'cusStateName',
    );
    const normalizedStateCode = this.normalizeStateCode(saveCustomerDto.cusStateCode);
    const now = new Date();
    const createdBy = resolveActor(saveCustomerDto.cusCreatedBy, this.requestContextService.getUserId());
     const data: Prisma.CustomerUncheckedCreateInput = {
      cusStateName: normalizedStateName,
      cusStateCode: normalizedStateCode,
      cusCompanyId: hasOwnProperty(saveCustomerDto, 'cusCompanyId')
        ? (saveCustomerDto.cusCompanyId ?? null)
        : null,
      cusAreaId: saveCustomerDto.cusAreaId,
      cusGroupId: saveCustomerDto.cusGroupId,
      cusPriceLevelId: saveCustomerDto.cusPriceLevelId,
      cusCollectionDays: hasOwnProperty(saveCustomerDto, 'cusCollectionDays')
        ? (saveCustomerDto.cusCollectionDays ?? [])
        : [],
      cusBilledDate: now,
      cusBilledCount: 1,
      cusCreatedOn: now,
      cusCreatedBy: createdBy,
    };
    this.applyOptionalFields(data, saveCustomerDto);
    // Ensure the normalized, required name wins over the raw value applied above.
    data.cusName = normalizedName;
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureCompanyExists(tx, data.cusCompanyId ?? null);
        await this.ensureAreaExists(tx, data.cusAreaId);
        await this.ensureCustomerGroupExists(tx, data.cusGroupId);
        // Provision the linked account ledger first, then reuse its led_id as the
        // customer's cus_id so the two masters share one identity (1:1 link). The
        // area shares its id with a linked account group, so cusAreaId doubles as
        // the ledger's parent account group id (ledGroupId).
        const ledgerDto = this.buildLinkedLedgerDto(saveCustomerDto, {
          name: normalizedName,
          stateName: normalizedStateName,
          stateCode: normalizedStateCode,
        });
        const ledger = await this.accountLedgerMastersService.createLedgerWithinTx(ledgerDto, tx);
        data.cusId = ledger.ledId;
        const created = await tx.customer.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: CUSTOMER_TABLE_NAME,
            screenName: CUSTOMER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.cusId,
            displayName: payload.cusName || payload.cusId,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Customer created',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<CustomerErrorDetail, CustomerErrorResponse>(
        error,
        'Customer already exists',
        [
          {
            field: 'cusName',
            message: 'Duplicate customer details are not allowed',
          },
        ],
      );
      throw error;
    }
  }
  private async updateCustomer(saveCustomerDto: SaveCustomerDto): Promise<CustomerPayload> {
    const cusId = saveCustomerDto.cusId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.customer.findFirst({
          where: {
            cusId,
            cusIsDeleted: false,
          },
        });
        if (!existing) {
          throwSalesNotFound<CustomerErrorDetail, CustomerErrorResponse>(
            'Customer not found',
            'cusId',
            `No active customer found with id ${cusId}`,
          );
        }
        const normalizedStateName = normalizeRequiredText<
          CustomerErrorDetail,
          CustomerErrorResponse
        >(saveCustomerDto.cusStateName, 'cusStateName');
        const normalizedStateCode = this.normalizeStateCode(saveCustomerDto.cusStateCode);
        const nextAreaId = hasOwnProperty(saveCustomerDto, 'cusAreaId')
          ? saveCustomerDto.cusAreaId
          : existing.cusAreaId;
        const nextGroupId = hasOwnProperty(saveCustomerDto, 'cusGroupId')
          ? saveCustomerDto.cusGroupId
          : existing.cusGroupId;
        const nextCompanyId = hasOwnProperty(saveCustomerDto, 'cusCompanyId')
          ? (saveCustomerDto.cusCompanyId ?? null)
          : existing.cusCompanyId;
        const nextPriceLevelId = hasOwnProperty(saveCustomerDto, 'cusPriceLevelId')
          ? saveCustomerDto.cusPriceLevelId
          : existing.cusPriceLevelId;
        await this.ensureCompanyExists(tx, nextCompanyId);
        await this.ensureAreaExists(tx, nextAreaId);
        await this.ensureCustomerGroupExists(tx, nextGroupId);
        const now = new Date();
        const data: Prisma.CustomerUncheckedUpdateInput = {
          cusStateName: normalizedStateName,
          cusStateCode: normalizedStateCode,
          cusCompanyId: nextCompanyId,
          cusAreaId: nextAreaId,
          cusGroupId: nextGroupId,
          cusPriceLevelId: nextPriceLevelId,
          cusBilledDate: now,
          cusBilledCount: {
            increment: 1,
          },
          cusModifiedOn: now,
          cusModifiedBy: resolveActor(saveCustomerDto.cusModifiedBy, this.requestContextService.getUserId()),
        };
        this.applyOptionalFields(data, saveCustomerDto);
        const updated = await tx.customer.update({
          where: {
            cusId,
          },
          data,
        });
        // Keep the linked account ledger (shares cus_id as its PK) in sync with the edited
        // customer fields, mirroring how createCustomer provisions it. Same transaction =>
        // atomic. Guarded so legacy customers with no linked ledger stay a no-op.
        const linkedLedger = await tx.accLedgerMaster.findFirst({
          where: { ledId: cusId, ledIsDeleted: false },
          select: { ledId: true, ledName: true },
        });
        if (linkedLedger) {
          const ledgerDto = this.buildLinkedLedgerDto(saveCustomerDto, {
            // ledName is required but cusName is nullable; fall back to the ledger's own current
            // name when the customer name is empty so the sync can't 400 or blank the ledger.
            name: updated.cusName || linkedLedger.ledName,
            stateName: normalizedStateName,
            stateCode: normalizedStateCode,
          });
          ledgerDto.ledId = cusId;
          ledgerDto.ledGroupId = nextAreaId;
          try {
            await this.accountLedgerMastersService.updateLedgerWithinTx(ledgerDto, tx);
          } catch (error: unknown) {
            // The linked-ledger write enforces company-scoped name uniqueness. Surface a
            // collision in the customer's own vocabulary instead of leaking the ledName field.
            if (error instanceof ConflictException) {
              throwSalesConflict<CustomerErrorDetail, CustomerErrorResponse>(
                'Customer name already exists for this company',
                [
                  {
                    field: 'cusName',
                    message: 'Duplicate customer name is not allowed for this company',
                  },
                ],
              );
            }
            throw error;
          }
        }
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: CUSTOMER_TABLE_NAME,
            screenName: CUSTOMER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: cusId,
            displayName: payload.cusName || payload.cusId,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.cusModifiedBy,
            notes: 'Customer updated',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<CustomerErrorDetail, CustomerErrorResponse>(
        error,
        'Customer already exists',
        [
          {
            field: 'cusName',
            message: 'Duplicate customer details are not allowed',
          },
        ],
      );
      throw error;
    }
  }
  private async resolveRelatedNames(
    client: CustomerWriteClient,
    record: Pick<Customer, 'cusCompanyId' | 'cusBranchId' | 'cusAreaId'>,
  ): Promise<{
    cusCompanyName: string | null;
    cusBranchName: string | null;
    cusAreaName: string | null;
  }> {
    const [company, branch, area] = await Promise.all([
      record.cusCompanyId
        ? client.company.findFirst({
            where: { compId: record.cusCompanyId },
            select: { compName: true },
          })
        : null,
      record.cusBranchId
        ? client.branchMaster.findFirst({
            where: { brId: record.cusBranchId },
            select: { brName: true },
          })
        : null,
      record.cusAreaId
        ? client.areaMaster.findFirst({
            where: { armId: record.cusAreaId },
            select: { armName: true },
          })
        : null,
    ]);
    return {
      cusCompanyName: company?.compName ?? null,
      cusBranchName: branch?.brName ?? null,
      cusAreaName: area?.armName ?? null,
    };
  }
  private async ensureAreaExists(tx: CustomerWriteClient, areaId: string): Promise<void> {
    const area = await tx.areaMaster.findFirst({
      where: {
        armId: areaId,
        armIsDeleted: false,
      },
      select: {
        armId: true,
      },
    });
    if (!area) {
      throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>('Area does not exist', [
        {
          field: 'cusAreaId',
          message: `No active area found with id ${areaId}`,
        },
      ]);
    }
  }
  private async ensureCompanyExists(
    tx: CustomerWriteClient,
    companyId: string | null,
  ): Promise<void> {
    if (companyId === null) {
      return;
    }
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
      throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>('Company does not exist', [
        {
          field: 'cusCompanyId',
          message: `No active company found with id ${companyId}`,
        },
      ]);
    }
  }
  private async ensureCustomerGroupExists(tx: CustomerWriteClient, groupId: string): Promise<void> {
    const group = await tx.custGroup.findFirst({
      where: {
        cgrId: groupId,
        cgrIsDeleted: false,
      },
      select: {
        cgrId: true,
      },
    });
    if (!group) {
      throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>(
        'Customer group does not exist',
        [
          {
            field: 'cusGroupId',
            message: `No active customer group found with id ${groupId}`,
          },
        ],
      );
    }
  }
  // Map the customer payload onto a ledger DTO for the linked account ledger.
  // ledGroupId comes from cusAreaId (the area shares its id with a linked account
  // group); the remaining required fields come from the customer's already-normalized
  // values, and the shared fields are copied only when present on the customer payload.
  private buildLinkedLedgerDto(
    saveCustomerDto: SaveCustomerDto,
    normalized: { name: string; stateName: string; stateCode: string },
  ): SaveAccountLedgerMasterDto {
    const ledgerDto: SaveAccountLedgerMasterDto = {
      ledGroupId: saveCustomerDto.cusAreaId,
      ledName: normalized.name,
      ledStateName: normalized.stateName,
      ledStateCode: normalized.stateCode,
    };
    const ledgerDtoRecord = ledgerDto as unknown as Record<string, unknown>;
    const customerRecord = saveCustomerDto as unknown as Record<string, unknown>;
    for (const [cusField, ledField] of CUSTOMER_TO_LEDGER_FIELD_MAP) {
      if (hasOwnProperty(saveCustomerDto, cusField)) {
        ledgerDtoRecord[ledField] = customerRecord[cusField];
      }
    }
    return ledgerDto;
  }

  private applyOptionalFields(
    data: Prisma.CustomerUncheckedCreateInput | Prisma.CustomerUncheckedUpdateInput,
    saveCustomerDto: SaveCustomerDto,
  ): void {
    applyPresentFields(data, saveCustomerDto, CUSTOMER_OPTIONAL_FIELDS, {
      cusBirthDate: (value) =>
        this.toDateOrNull(value as string | null | undefined, 'cusBirthDate'),
      cusMarriageDate: (value) =>
        this.toDateOrNull(value as string | null | undefined, 'cusMarriageDate'),
      cusCollectionDays: (value) => value ?? [],
    });
  }
  private normalizeStateCode(value: string): string {
    const normalized = value.trim().toUpperCase();
    if (normalized.length !== 2) {
      throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>('Validation failed', [
        {
          field: 'cusStateCode',
          message: 'cusStateCode must be exactly 2 characters',
        },
      ]);
    }
    return normalized;
  }
  private toDateOrNull(value: string | null | undefined, field: string): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    const dateValue = new Date(value);
    if (Number.isNaN(dateValue.getTime())) {
      throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>('Validation failed', [
        {
          field,
          message: `${field} must be a valid ISO date`,
        },
      ]);
    }
    return dateValue;
  }
  private toPayload(record: Customer): CustomerPayload {
    return {
      cusId: record.cusId,
      cusTitle: record.cusTitle,
      cusShort: record.cusShort,
      cusCode: record.cusCode,
      cusName: record.cusName,
      cusAddr1: record.cusAddr1,
      cusAddr2: record.cusAddr2,
      cusAddr3: record.cusAddr3,
      cusCity: record.cusCity,
      cusDistrict: record.cusDistrict,
      cusStateName: record.cusStateName,
      cusCountry: record.cusCountry,
      cusStateCode: record.cusStateCode,
      cusLandmark: record.cusLandmark,
      cusPin: record.cusPin,
      cusTel: record.cusTel,
      cusPhone1: record.cusPhone1,
      cusPhone2: record.cusPhone2,
      cusWhatsappNo: record.cusWhatsappNo,
      cusEmail: record.cusEmail,
      cusAadharNo: record.cusAadharNo,
      cusContactPerson: record.cusContactPerson,
      cusDistanceKm: record.cusDistanceKm,
      cusCreditAllowed: record.cusCreditAllowed,
      cusCreditBillLimit: record.cusCreditBillLimit,
      cusCreditAmtLimit: toNumber(record.cusCreditAmtLimit),
      cusCreditDays: record.cusCreditDays,
      cusDebitBalance: toNumber(record.cusDebitBalance),
      cusDiscPerc: toNumber(record.cusDiscPerc),
      cusDebitGraceDays: record.cusDebitGraceDays,
      cusEnableSms: record.cusEnableSms,
      cusOverdueSms: record.cusOverdueSms,
      cusOverdueBilling: record.cusOverdueBilling,
      cusAllowPromotion: record.cusAllowPromotion,
      cusAllowLoyalty: record.cusAllowLoyalty,
      cusAllowDiscount: record.cusAllowDiscount,
      cusSortOrder: record.cusSortOrder,
      cusRegionName: record.cusRegionName,
      cusRegionAddr1: record.cusRegionAddr1,
      cusRegionAddr2: record.cusRegionAddr2,
      cusRegionAddr3: record.cusRegionAddr3,
      cusRegionCity: record.cusRegionCity,
      cusRegionDistrict: record.cusRegionDistrict,
      cusRegionStateName: record.cusRegionStateName,
      cusRegionCountry: record.cusRegionCountry,
      cusBirthDate: record.cusBirthDate ? record.cusBirthDate.toISOString() : null,
      cusMarriageDate: record.cusMarriageDate ? record.cusMarriageDate.toISOString() : null,
      cusTransportName: record.cusTransportName,
      cusFreightCharge: record.cusFreightCharge,
      cusLoadingCharge: record.cusLoadingCharge,
      cusUnloadingCharge: record.cusUnloadingCharge,
      cusGstNo: record.cusGstNo,
      cusPanNo: record.cusPanNo,
      cusGstType: record.cusGstType,
      cusEcommerceGstin: record.cusEcommerceGstin,
      cusTcsApplicable: record.cusTcsApplicable,
      cusItcollExempted: record.cusItcollExempted,
      cusItcollType: record.cusItcollType,
      cusGeoLocation: record.cusGeoLocation,
      cusCollectionDays: record.cusCollectionDays,
      cusDefaultSalesman: record.cusDefaultSalesman,
      cusPriceLevelId: record.cusPriceLevelId,
      cusBilledDate: record.cusBilledDate ? record.cusBilledDate.toISOString() : null,
      cusBilledCount: record.cusBilledCount,
      cusNotes: record.cusNotes,
      cusCompanyId: record.cusCompanyId,
      cusBranchId: record.cusBranchId,
      cusAreaId: record.cusAreaId,
      cusGroupId: record.cusGroupId,
      cusIsActive: record.cusIsActive,
      cusIsDeleted: record.cusIsDeleted,
      cusSyncDate: record.cusSyncDate ? record.cusSyncDate.toISOString() : null,
      cusCreatedOn: record.cusCreatedOn.toISOString(),
      cusCreatedBy: record.cusCreatedBy,
      cusModifiedOn: record.cusModifiedOn.toISOString(),
      cusModifiedBy: record.cusModifiedBy,
    };
  }
}