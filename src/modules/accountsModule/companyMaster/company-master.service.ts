import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { Company, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListCompanyMasterQueryDto } from './dto/list-company-master-query.dto';
import { SaveCompanyMasterDto } from './dto/save-company-master.dto';
import {
  CompanyMasterErrorDetail,
  CompanyMasterErrorResponse,
  CompanyMasterListItem,
  CompanyMasterListMeta,
  CompanyMasterPayload,
} from './types/company-master-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const COMPANY_MASTER_TABLE_NAME = 'companys';
const COMPANY_MASTER_AUDIT_SCREEN_NAME = 'Company Master';

type CompanyWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class CompanyMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) { }

  async save(saveCompanyMasterDto: SaveCompanyMasterDto): Promise<CompanyMasterPayload> {
    if (saveCompanyMasterDto.compId) {
      return this.updateCompany(saveCompanyMasterDto);
    }

    return this.createCompany(saveCompanyMasterDto);
  }

  async list(
    queryDto: ListCompanyMasterQueryDto,
  ): Promise<{ items: CompanyMasterListItem[]; meta: CompanyMasterListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const hasStructuredFilters =
      queryDto.compIsActive !== undefined ||
      queryDto.compDefault !== undefined ||
      queryDto.compStateCode !== undefined ||
      Boolean(queryDto.search?.trim());

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where: Prisma.CompanyWhereInput = {
      compIsDeleted: false,
    };

    if (queryDto.compIsActive !== undefined) {
      where.compIsActive = queryDto.compIsActive;
    }

    if (queryDto.compDefault !== undefined) {
      where.compDefault = queryDto.compDefault;
    }

    if (queryDto.compStateCode !== undefined) {
      where.compStateCode = queryDto.compStateCode;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { compCode: { contains: search, mode: 'insensitive' } },
        { compName: { contains: search, mode: 'insensitive' } },
        { compShort: { contains: search, mode: 'insensitive' } },
        { compLegalName: { contains: search, mode: 'insensitive' } },
        { compGstinNo: { contains: search, mode: 'insensitive' } },
        { compPanNo: { contains: search, mode: 'insensitive' } },
        { compCity: { contains: search, mode: 'insensitive' } },
        { compDistrict: { contains: search, mode: 'insensitive' } },
        { compState: { contains: search, mode: 'insensitive' } },
        { compMail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        orderBy: [{ compDefault: 'desc' }, { compName: 'asc' }, { compId: 'asc' }],
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

  private async listFromConfiguredGridSql(
    page: number,
    limit: number,
    skip: number,
  ): Promise<{ items: CompanyMasterListItem[]; meta: CompanyMasterListMeta } | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: COMPANY_MASTER_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      COMPANY_MASTER_TABLE_NAME,
    );
    if (primaryConfiguredGrids.length === 0) {
      return null;
    }

    for (const configuredGrid of primaryConfiguredGrids) {
      const rawGridSql = configuredGrid.gridSql?.trim();
      if (!rawGridSql) {
        continue;
      }

      const validation = this.configuredGridSqlService.validateBaseSql({
        sql: rawGridSql,
        tableName: COMPANY_MASTER_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }

      try {
        const result = await this.configuredGridSqlService.runPagedQuery<CompanyMasterListItem>({
          baseSql: validation.normalizedSql,
          alias: 'company_master_grid',
          limit,
          skip,
        });

        return {
          items: result.items,
          meta: {
            page,
            limit,
            total: result.total,
            total_pages: Math.ceil(result.total / limit),
          },
        };
      } catch {
        continue;
      }
    }

    return null;
  }

  async getById(compId: string): Promise<CompanyMasterPayload> {
    const record = await this.prisma.company.findFirst({
      where: {
        compId,
        compIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(compId);
    }

    return this.toPayload(record);
  }

  async softDelete(compId: string): Promise<{ compId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.company.findFirst({
        where: {
          compId,
          compIsDeleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound(compId);
      }

      const modifiedOn = new Date();
      const result = await tx.company.updateMany({
        where: {
          compId,
          compIsDeleted: false,
        },
        data: {
          compIsDeleted: true,
          compIsActive: false,
          compDefault: false,
          compModifiedOn: modifiedOn,
          compModifiedBy: DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        this.throwNotFound(compId);
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        compIsDeleted: true,
        compIsActive: false,
        compDefault: false,
        compModifiedOn: modifiedOn,
        compModifiedBy: DEFAULT_ACTOR,
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: COMPANY_MASTER_TABLE_NAME,
          screenName: COMPANY_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: String(compId),
          displayName: existing.compName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Company soft deleted',
        },
        tx,
      );

      return {
        compId,
        deleted: true,
      };
    });
  }

  private async createCompany(
    saveCompanyMasterDto: SaveCompanyMasterDto,
  ): Promise<CompanyMasterPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const compName = this.normalizeRequiredName(saveCompanyMasterDto.compName, 'compName');
        const compStateCode = this.normalizeLengthCode(
          saveCompanyMasterDto.compStateCode,
          2,
          'compStateCode',
        );

        await this.ensureNameIsUnique(tx, compName);
        await this.ensureCodeIsUnique(tx, saveCompanyMasterDto.compCode ?? null);
        await this.ensureGstinIsUnique(tx, saveCompanyMasterDto.compGstinNo ?? null);

        if (saveCompanyMasterDto.compDefault === true) {
          await this.clearDefaultCompany(tx);
        }

        const now = new Date();
        const data: Prisma.CompanyUncheckedCreateInput = {
          compName,
          compStateCode,
          compStylesheetId: saveCompanyMasterDto.compStylesheetId,
          compCreatedOn: now,
          compCreatedBy: DEFAULT_ACTOR,
          compModifiedOn: now,
          compModifiedBy: DEFAULT_ACTOR,
        };

        this.applyOptionalFields(data, saveCompanyMasterDto);

        const created = await tx.company.create({ data });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: COMPANY_MASTER_TABLE_NAME,
            screenName: COMPANY_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: String(payload.compId),
            displayName: payload.compName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Company created',
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

  private async updateCompany(
    saveCompanyMasterDto: SaveCompanyMasterDto,
  ): Promise<CompanyMasterPayload> {
    const compId = saveCompanyMasterDto.compId!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.company.findFirst({
          where: {
            compId,
            compIsDeleted: false,
          },
        });

        if (!existing) {
          this.throwNotFound(compId);
        }

        const compName = this.normalizeRequiredName(saveCompanyMasterDto.compName, 'compName');
        const compStateCode = this.normalizeLengthCode(
          saveCompanyMasterDto.compStateCode,
          2,
          'compStateCode',
        );

        await this.ensureNameIsUnique(tx, compName, compId);
        await this.ensureCodeIsUnique(tx, saveCompanyMasterDto.compCode ?? null, compId);
        await this.ensureGstinIsUnique(tx, saveCompanyMasterDto.compGstinNo ?? null, compId);

        if (saveCompanyMasterDto.compDefault === true) {
          await this.clearDefaultCompany(tx, compId);
        }

        const data: Prisma.CompanyUncheckedUpdateInput = {
          compName,
          compStateCode,
          compStylesheetId: saveCompanyMasterDto.compStylesheetId,
          compModifiedOn: new Date(),
          compModifiedBy: DEFAULT_ACTOR,
        };

        this.applyOptionalFields(data, saveCompanyMasterDto);

        const updated = await tx.company.update({
          where: {
            compId,
          },
          data,
        });
        const payload = this.toPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: COMPANY_MASTER_TABLE_NAME,
            screenName: COMPANY_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: String(compId),
            displayName: payload.compName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Company updated',
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

  private async ensureNameIsUnique(
    tx: CompanyWriteClient,
    compName: string,
    excludeCompId?: string,
  ): Promise<void> {
    const existing = await tx.company.findFirst({
      where: {
        compName: {
          equals: compName,
          mode: 'insensitive',
        },
        ...(excludeCompId !== undefined
          ? {
            compId: {
              not: excludeCompId,
            },
          }
          : {}),
      },
      select: {
        compId: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        this.buildErrorResponse('Company name already exists', [
          {
            field: 'compName',
            message: 'Duplicate compName is not allowed',
          },
        ]),
      );
    }
  }

  private async ensureCodeIsUnique(
    tx: CompanyWriteClient,
    compCode: string | null,
    excludeCompId?: string,
  ): Promise<void> {
    if (!compCode) {
      return;
    }

    const existing = await tx.company.findFirst({
      where: {
        compCode: {
          equals: compCode,
          mode: 'insensitive',
        },
        ...(excludeCompId !== undefined
          ? {
            compId: {
              not: excludeCompId,
            },
          }
          : {}),
      },
      select: {
        compId: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        this.buildErrorResponse('Company code already exists', [
          {
            field: 'compCode',
            message: 'Duplicate compCode is not allowed',
          },
        ]),
      );
    }
  }

  private async ensureGstinIsUnique(
    tx: CompanyWriteClient,
    compGstinNo: string | null,
    excludeCompId?: string,
  ): Promise<void> {
    if (!compGstinNo) {
      return;
    }

    const existing = await tx.company.findFirst({
      where: {
        compGstinNo: {
          equals: compGstinNo,
          mode: 'insensitive',
        },
        ...(excludeCompId !== undefined
          ? {
            compId: {
              not: excludeCompId,
            },
          }
          : {}),
      },
      select: {
        compId: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        this.buildErrorResponse('Company GSTIN already exists', [
          {
            field: 'compGstinNo',
            message: 'Duplicate compGstinNo is not allowed',
          },
        ]),
      );
    }
  }

  private async clearDefaultCompany(tx: CompanyWriteClient, excludeCompId?: string): Promise<void> {
    await tx.company.updateMany({
      where: {
        compIsDeleted: false,
        compDefault: true,
        ...(excludeCompId !== undefined
          ? {
            compId: {
              not: excludeCompId,
            },
          }
          : {}),
      },
      data: {
        compDefault: false,
        compModifiedOn: new Date(),
        compModifiedBy: DEFAULT_ACTOR,
      },
    });
  }

  private applyOptionalFields(
    data: Prisma.CompanyUncheckedCreateInput | Prisma.CompanyUncheckedUpdateInput,
    saveCompanyMasterDto: SaveCompanyMasterDto,
  ): void {
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compCode')) {
      data.compCode = saveCompanyMasterDto.compCode;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compShort')) {
      data.compShort = saveCompanyMasterDto.compShort;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compLegalName')) {
      data.compLegalName = saveCompanyMasterDto.compLegalName;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compGstinNo')) {
      data.compGstinNo = saveCompanyMasterDto.compGstinNo;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compGstRegType')) {
      data.compGstRegType = saveCompanyMasterDto.compGstRegType;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compPanNo')) {
      data.compPanNo = saveCompanyMasterDto.compPanNo;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compFssaiNo')) {
      data.compFssaiNo = saveCompanyMasterDto.compFssaiNo;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compAddr1')) {
      data.compAddr1 = saveCompanyMasterDto.compAddr1;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compAddr2')) {
      data.compAddr2 = saveCompanyMasterDto.compAddr2;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compAddr3')) {
      data.compAddr3 = saveCompanyMasterDto.compAddr3;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compCity')) {
      data.compCity = saveCompanyMasterDto.compCity;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compDistrict')) {
      data.compDistrict = saveCompanyMasterDto.compDistrict;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compState')) {
      data.compState = saveCompanyMasterDto.compState;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compPin')) {
      data.compPin = saveCompanyMasterDto.compPin;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compCountry')) {
      data.compCountry = saveCompanyMasterDto.compCountry;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compRegionAddr1')) {
      data.compRegionAddr1 = saveCompanyMasterDto.compRegionAddr1;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compRegionAddr2')) {
      data.compRegionAddr2 = saveCompanyMasterDto.compRegionAddr2;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compRegionAddr3')) {
      data.compRegionAddr3 = saveCompanyMasterDto.compRegionAddr3;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compRegionCity')) {
      data.compRegionCity = saveCompanyMasterDto.compRegionCity;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compRegionDistrict')) {
      data.compRegionDistrict = saveCompanyMasterDto.compRegionDistrict;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compRegionState')) {
      data.compRegionState = saveCompanyMasterDto.compRegionState;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compRegionCountry')) {
      data.compRegionCountry = saveCompanyMasterDto.compRegionCountry;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compTel')) {
      data.compTel = saveCompanyMasterDto.compTel;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compPhone')) {
      data.compPhone = saveCompanyMasterDto.compPhone;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compMail')) {
      data.compMail = saveCompanyMasterDto.compMail;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compSupportEmail')) {
      data.compSupportEmail = saveCompanyMasterDto.compSupportEmail;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compSupportPhone')) {
      data.compSupportPhone = saveCompanyMasterDto.compSupportPhone;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compWebsiteName')) {
      data.compWebsiteName = saveCompanyMasterDto.compWebsiteName;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compFinYearFrom')) {
      data.compFinYearFrom = saveCompanyMasterDto.compFinYearFrom;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compFinYearTo')) {
      data.compFinYearTo = saveCompanyMasterDto.compFinYearTo;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compBooksBeginFrom')) {
      data.compBooksBeginFrom = saveCompanyMasterDto.compBooksBeginFrom;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compGstApplicable')) {
      data.compGstApplicable = saveCompanyMasterDto.compGstApplicable;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compTcsApplicable')) {
      data.compTcsApplicable = saveCompanyMasterDto.compTcsApplicable;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compSmsApplicable')) {
      data.compSmsApplicable = saveCompanyMasterDto.compSmsApplicable;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compEinvoiceApplicable')) {
      data.compEinvoiceApplicable = saveCompanyMasterDto.compEinvoiceApplicable;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compEwayApplicable')) {
      data.compEwayApplicable = saveCompanyMasterDto.compEwayApplicable;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compEwayDate')) {
      data.compEwayDate = saveCompanyMasterDto.compEwayDate;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compEwayInterLimit')) {
      data.compEwayInterLimit = saveCompanyMasterDto.compEwayInterLimit;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compEwayIntraApl')) {
      data.compEwayIntraApl = saveCompanyMasterDto.compEwayIntraApl;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compEwayIntraLimit')) {
      data.compEwayIntraLimit = saveCompanyMasterDto.compEwayIntraLimit;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compEinvoiceDate')) {
      data.compEinvoiceDate = saveCompanyMasterDto.compEinvoiceDate;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compEinvoiceInclEway')) {
      data.compEinvoiceInclEway = saveCompanyMasterDto.compEinvoiceInclEway;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compBankId')) {
      data.compBankId = saveCompanyMasterDto.compBankId;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compPriceFixing')) {
      data.compPriceFixing = saveCompanyMasterDto.compPriceFixing;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compPrefixCode')) {
      data.compPrefixCode = saveCompanyMasterDto.compPrefixCode;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compBillGreeting')) {
      data.compBillGreeting = saveCompanyMasterDto.compBillGreeting;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compNegStkApl')) {
      data.compNegStkApl = saveCompanyMasterDto.compNegStkApl;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compDefault')) {
      data.compDefault = saveCompanyMasterDto.compDefault;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compIsActive')) {
      data.compIsActive = saveCompanyMasterDto.compIsActive;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compCurrencyCode')) {
      data.compCurrencyCode = saveCompanyMasterDto.compCurrencyCode;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compCurrencySymbol')) {
      data.compCurrencySymbol = saveCompanyMasterDto.compCurrencySymbol;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compLocaleCode')) {
      data.compLocaleCode = saveCompanyMasterDto.compLocaleCode;
    }
    if (this.hasOwnProperty(saveCompanyMasterDto, 'compRemarks')) {
      data.compRemarks = saveCompanyMasterDto.compRemarks;
    }
  }

  private normalizeRequiredName(value: string, field: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      this.throwBadRequest('Validation failed', [
        {
          field,
          message: `${field} must not be empty`,
        },
      ]);
    }

    return trimmed;
  }

  private normalizeLengthCode(value: string, length: number, field: string): string {
    const normalized = value.trim().toUpperCase();
    if (normalized.length !== length) {
      this.throwBadRequest('Validation failed', [
        {
          field,
          message: `${field} must be exactly ${length} characters`,
        },
      ]);
    }

    return normalized;
  }

  private toPayload(record: Company): CompanyMasterPayload {
    return {
      compId: record.compId,
      compCode: record.compCode,
      compName: record.compName,
      compShort: record.compShort,
      compLegalName: record.compLegalName,
      compGstinNo: record.compGstinNo,
      compGstRegType: record.compGstRegType,
      compPanNo: record.compPanNo,
      compFssaiNo: record.compFssaiNo,
      compDrugLicenseNo: record.compDrugLicenseNo,
      compAddr1: record.compAddr1,
      compAddr2: record.compAddr2,
      compAddr3: record.compAddr3,
      compCity: record.compCity,
      compDistrict: record.compDistrict,
      compState: record.compState,
      compStateCode: record.compStateCode,
      compPin: record.compPin,
      compCountry: record.compCountry,
      compRegionAddr1: record.compRegionAddr1,
      compRegionAddr2: record.compRegionAddr2,
      compRegionAddr3: record.compRegionAddr3,
      compRegionCity: record.compRegionCity,
      compRegionDistrict: record.compRegionDistrict,
      compRegionState: record.compRegionState,
      compRegionCountry: record.compRegionCountry,
      compTel: record.compTel,
      compPhone: record.compPhone,
      compMail: record.compMail,
      compSupportEmail: record.compSupportEmail,
      compSupportPhone: record.compSupportPhone,
      compWebsiteName: record.compWebsiteName,
      compFinYearFrom: record.compFinYearFrom ? record.compFinYearFrom.toISOString() : null,
      compFinYearTo: record.compFinYearTo ? record.compFinYearTo.toISOString() : null,
      compBooksBeginFrom: record.compBooksBeginFrom
        ? record.compBooksBeginFrom.toISOString()
        : null,
      compGstApplicable: record.compGstApplicable,
      compTcsApplicable: record.compTcsApplicable,
      compSmsApplicable: record.compSmsApplicable,
      compEinvoiceApplicable: record.compEinvoiceApplicable,
      compEwayApplicable: record.compEwayApplicable,
      compEwayDate: record.compEwayDate ? record.compEwayDate.toISOString() : null,
      compEwayInterLimit: this.toNullableNumber(record.compEwayInterLimit),
      compEwayIntraApl: record.compEwayIntraApl,
      compEwayIntraLimit: this.toNumber(record.compEwayIntraLimit),
      compEinvoiceDate: record.compEinvoiceDate ? record.compEinvoiceDate.toISOString() : null,
      compEinvoiceInclEway: record.compEinvoiceInclEway,
      compStylesheetId: record.compStylesheetId,
      compBankId: record.compBankId,
      compPriceFixing: record.compPriceFixing,
      compPrefixCode: record.compPrefixCode,
      compBillGreeting: record.compBillGreeting,
      compNegStkApl: record.compNegStkApl,
      compDefault: record.compDefault,
      compIsActive: record.compIsActive,
      compCurrencyCode: record.compCurrencyCode,
      compCurrencySymbol: record.compCurrencySymbol,
      compLocaleCode: record.compLocaleCode,
      compRemarks: record.compRemarks,
      compIsDeleted: record.compIsDeleted,
      compSyncDate: record.compSyncDate ? record.compSyncDate.toISOString() : null,
      compCreatedOn: record.compCreatedOn.toISOString(),
      compCreatedBy: record.compCreatedBy,
      compModifiedOn: record.compModifiedOn.toISOString(),
      compModifiedBy: record.compModifiedBy,
    };
  }

  private toNumber(value: Prisma.Decimal | number): number {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value.toString());
  }

  private toNullableNumber(value: Prisma.Decimal | number | null): number | null {
    if (value === null) {
      return null;
    }

    return this.toNumber(value);
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Company already exists', [
          {
            field: 'compName',
            message: 'Duplicate company unique value is not allowed',
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

  private throwNotFound(compId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Company not found', [
        {
          field: 'compId',
          message: `No active company found with id ${compId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: CompanyMasterErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: CompanyMasterErrorDetail[] = [],
  ): CompanyMasterErrorResponse {
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
