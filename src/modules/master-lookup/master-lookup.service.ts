import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  ACCOUNT_LOOKUP_MODULE_KEYS,
  AccountsLookupModuleKey,
  LookupModuleKey,
  LOOKUP_MODULE_KEYS,
  MasterLookupDataPayload,
  NameIdOption,
  SingleModuleLookupPayload,
} from './types/master-lookup-api.types';
// ─── Constants ───────────────────────────────────────────────────────────────
const DEFAULT_SEARCH_LIMIT = 20;
const MAX_LOOKUP_LIMIT = 100;
const LOOKUP_NAME_NOISE_TOKENS = new Set(['master', 'lookup', 'dropdown']);
const CONFIGURED_SQL_TABLE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\binventory\s*\.\s*units\b/gi, 'inventory.item_unit_master'],
  [/"inventory"\s*\.\s*"units"/gi, '"inventory"."item_unit_master"'],
  [/\baccounts\s*\.\s*companys\b/gi, 'public.companys'],
  [/"accounts"\s*\.\s*"companys"/gi, '"public"."companys"'],
  [/\baccounts\s*\.\s*branch_master\b/gi, 'public.branch_master'],
  [/"accounts"\s*\.\s*"branch_master"/gi, '"public"."branch_master"'],
];
// ─── Aliases ─────────────────────────────────────────────────────────────────
const MODULE_DROPDOWN_NAME_ALIASES: Record<LookupModuleKey, string[]> = {
  companies: ['companies', 'company'],
  companyGroups: ['company groups', 'company group'],
  branches: ['branches', 'branch'],
  accountGroups: ['account groups', 'account group', 'account ledger groups', 'ledger groups'],
  accountLedgers: ['account ledgers', 'account ledger', 'ledgers', 'ledger'],
  ledgerBankAccounts: ['ledger bank accounts', 'ledger bank account', 'bank accounts', 'bank account'],
  ledgerShippingAddresses: [
    'ledger shipping addresses',
    'ledger shipping address',
    'shipping addresses',
    'shipping address',
  ],
  employeeDepartments: ['employee departments', 'employee department', 'departments', 'department'],
  employeeDesignations: ['employee designations', 'employee designation', 'designations', 'designation'],
  employees: ['employees', 'employee'],
  tenderTypes: ['tender types', 'tender type'],
  tenders: ['tenders', 'tender'],
  gspProviders: ['gsp providers', 'gsp provider', 'providers', 'provider'],
  gspCompanyServices: ['gsp company services', 'gsp company service', 'company services', 'company service'],
  itemGroups: ['item groups', 'item group'],
  itemCategories: ['item categories', 'item category', 'categories', 'category'],
  itemSections: ['item sections', 'item section', 'sections', 'section'],
  itemBrands: ['item brands', 'item brand', 'brands', 'brand'],
  units: ['units', 'unit'],
  itemTaxes: ['item taxes', 'item tax', 'taxes', 'tax'],
  priceLevels: ['price levels', 'price level'],
  hsnCodes: ['hsn codes', 'hsn code', 'hsn'],
  items: ['items', 'item'],
  godownLocations: ['godown locations', 'godown location', 'godowns', 'godown'],
  stateCodes: ['state codes', 'state code'],
  states: ['states', 'state'],
  cities: ['cities', 'city'],
  areas: ['areas', 'area'],
  customerGroups: ['customer groups', 'customer group', 'cust groups', 'cust group'],
  customers: ['customers', 'customer'],
  supplierGroups: ['supplier groups', 'supplier group'],
  suppliers: ['suppliers', 'supplier'],
  userMasters: ['user masters', 'user master', 'users', 'user'],
};
// ─── Types ────────────────────────────────────────────────────────────────────
type ModuleFetcher = (search: string | undefined, take: number | undefined) => Promise<NameIdOption[]>;
type DropdownLookupColumnConfig = {
  name: string;
  alias: string | null;
  filter: boolean;
  visible: boolean;
};
type DropdownLookupConfig = {
  dropdownId: number;
  dropdownName: string;
  dropdownSql: string;
  dropdownSqlRegional: string | null;
  dropdownSortColumn: string | null;
  dropdownSortOrder: string | null;
  dropdownColumns: DropdownLookupColumnConfig[];
};
type LookupRow = Record<string, unknown>;
type DropdownRecord = {
  dropdownId: number;
  dropdownName: string;
  dropdownSql: string;
  dropdownSqlRegional: string | null;
  dropdownSortColumn: string | null;
  dropdownSortOrder: string | null;
  dropdownColumns: Array<{
    dropColumnsColumnNo: number;
    dropColumnsColumnName: string;
    dropColumnsColumnAlias: string | null;
    dropColumnsColumnFilter: boolean;
    dropColumnsColumnVisiblity: boolean;
  }>;
};
// ─── Service ──────────────────────────────────────────────────────────────────
@Injectable()
export class MasterLookupService {
  private readonly moduleFetchers: Record<LookupModuleKey, ModuleFetcher>;
  constructor(private readonly prisma: PrismaService) {
    this.moduleFetchers = this.buildModuleFetchers();
  }
  // ─── Public API ─────────────────────────────────────────────────────────────
  async getAllAccountsAndMasterNameIds(
    module?: LookupModuleKey,
    search?: string,
    limit?: number,
  ): Promise<MasterLookupDataPayload> {
    const normalizedSearch = this.normalizeSearch(search);
    const take = this.resolveTake(normalizedSearch, limit);
    const configuredDropdowns = await this.loadLookupDropdownConfigs();
    if (module) {
      const items = await this.fetchModuleItems(module, normalizedSearch, take, configuredDropdowns);
      return this.toSingleModulePayload(module, items);
    }
    const entries = await Promise.all(
      LOOKUP_MODULE_KEYS.map(async (key) => [
        key,
        await this.fetchModuleItems(key, normalizedSearch, take, configuredDropdowns),
      ]),
    );
    const byModule = Object.fromEntries(entries) as Record<LookupModuleKey, NameIdOption[]>;
    return {
      accounts: {
        companies: byModule.companies,
        companyGroups: byModule.companyGroups,
        branches: byModule.branches,
        accountGroups: byModule.accountGroups,
        accountLedgers: byModule.accountLedgers,
        ledgerBankAccounts: byModule.ledgerBankAccounts,
        ledgerShippingAddresses: byModule.ledgerShippingAddresses,
        employeeDepartments: byModule.employeeDepartments,
        employeeDesignations: byModule.employeeDesignations,
        employees: byModule.employees,
        tenderTypes: byModule.tenderTypes,
        tenders: byModule.tenders,
        gspProviders: byModule.gspProviders,
        gspCompanyServices: byModule.gspCompanyServices,
      },
      masters: {
        itemGroups: byModule.itemGroups,
        itemCategories: byModule.itemCategories,
        itemSections: byModule.itemSections,
        itemBrands: byModule.itemBrands,
        units: byModule.units,
        itemTaxes: byModule.itemTaxes,
        priceLevels: byModule.priceLevels,
        hsnCodes: byModule.hsnCodes,
        items: byModule.items,
        godownLocations: byModule.godownLocations,
        stateCodes: byModule.stateCodes,
        states: byModule.states,
        cities: byModule.cities,
        areas: byModule.areas,
        customerGroups: byModule.customerGroups,
        customers: byModule.customers,
        supplierGroups: byModule.supplierGroups,
        suppliers: byModule.suppliers,
        userMasters: byModule.userMasters,
      },
    };
  }
  async getBranchesByCompany(companyId: string, search?: string, limit?: number): Promise<NameIdOption[]> {
    const normalizedSearch = this.normalizeSearch(search);
    const take = this.resolveTake(normalizedSearch, limit);
    const contains = normalizedSearch ? this.buildContainsFilter(normalizedSearch) : undefined;
    const rows = await this.prisma.branchMaster.findMany({
      where: {
        compId: companyId,
        brIsDeleted: false,
        brIsActive: true,
        ...(contains ? { brName: contains } : {}),
      },
      select: { brId: true, brName: true },
      orderBy: [{ brName: 'asc' }, { brId: 'asc' }],
      ...(take ? { take } : {}),
    });
    return rows.map((row) => this.toOption(row.brId, row.brName));
  }
  async getDropdownSqlData(dropdownId: number, search?: string, limit?: number): Promise<NameIdOption[]> {
    const record = await this.prisma.dropdownDetails.findUnique({
      where: { dropdownId },
      include: { dropdownColumns: { orderBy: [{ dropColumnsColumnNo: 'asc' }] } },
    });
    if (!record) return [];
    const config: DropdownLookupConfig = {
      dropdownId: record.dropdownId,
      dropdownName: record.dropdownName,
      dropdownSql: record.dropdownSql,
      dropdownSqlRegional: record.dropdownSqlRegional,
      dropdownSortColumn: record.dropdownSortColumn,
      dropdownSortOrder: record.dropdownSortOrder,
      dropdownColumns: record.dropdownColumns
        .filter((col) => col.dropColumnsColumnVisiblity)
        .map((col) => ({
          name: col.dropColumnsColumnName,
          alias: col.dropColumnsColumnAlias,
          filter: col.dropColumnsColumnFilter,
          visible: true,
        })),
    };
    const normalizedSearch = this.normalizeSearch(search);
    const take = this.resolveTake(normalizedSearch, limit);
    return (await this.tryFetchConfiguredModuleItems(config, normalizedSearch, take)) ?? [];
  }
  // ─── Module Fetcher Registry ─────────────────────────────────────────────────
  /**
   * Builds the registry of per-module table fetchers.
   * Simple modules (single name field) use `simpleFetcher`; complex ones are inlined.
   */
  private buildModuleFetchers(): Record<LookupModuleKey, ModuleFetcher> {
    return {
      companies: this.simpleFetcher(
        (c, take) =>
          this.prisma.company.findMany({
            where: { compIsDeleted: false, compIsActive: true, ...c({ compName: true }) },
            select: { compId: true, compName: true },
            orderBy: [{ compName: 'asc' }, { compId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.compId, row.compName),
      ),
      companyGroups: this.simpleFetcher(
        (c, take) =>
          this.prisma.companyGroupMaster.findMany({
            where: { cogIsDeleted: false, cogIsActive: true, ...c({ cogGroupName: true }) },
            select: { cogGroupId: true, cogGroupName: true },
            orderBy: [{ cogGroupName: 'asc' }, { cogGroupId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.cogGroupId, row.cogGroupName),
      ),
      branches: this.simpleFetcher(
        (c, take) =>
          this.prisma.branchMaster.findMany({
            where: { brIsDeleted: false, brIsActive: true, ...c({ brName: true }) },
            select: { brId: true, brName: true },
            orderBy: [{ brName: 'asc' }, { brId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.brId, row.brName),
      ),
      accountGroups: this.simpleFetcher(
        (c, take) =>
          this.prisma.accountGroup.findMany({
            where: { accGroupIsDeleted: false, accGroupIsActive: true, ...c({ accGroupName: true }) },
            select: { accGroupId: true, accGroupName: true },
            orderBy: [{ accGroupName: 'asc' }, { accGroupId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.accGroupId, row.accGroupName),
      ),
      accountLedgers: this.simpleFetcher(
        (c, take) =>
          this.prisma.accLedgerMaster.findMany({
            where: {
              ledIsDeleted: false,
              ledIsActive: true,
              ...c({ OR: [{ ledName: true }, { ledAlias: true }, { ledShort: true }] }),
            },
            select: { ledId: true, ledName: true },
            orderBy: [{ ledName: 'asc' }, { ledId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.ledId, row.ledName),
      ),
      ledgerBankAccounts: async (search, take) => {
        const contains = search ? this.buildContainsFilter(search) : undefined;
        const rows = await this.prisma.accLedgerBankAccount.findMany({
          where: {
            lbaIsDeleted: false,
            lbaIsActive: true,
            ...(contains
              ? {
                  OR: [
                    { lbaAccountHolder: contains },
                    { lbaAccountNo: contains },
                    { ledger: { is: { ledName: contains } } },
                  ],
                }
              : {}),
          },
          select: {
            lbaId: true,
            lbaAccountHolder: true,
            lbaAccountNo: true,
            ledger: { select: { ledName: true } },
          },
          orderBy: [{ lbaAccountHolder: 'asc' }, { lbaId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => {
          const ledgerSuffix = row.ledger?.ledName ? ` - ${row.ledger.ledName}` : '';
          return this.toOption(row.lbaId, `${row.lbaAccountHolder} (${row.lbaAccountNo})${ledgerSuffix}`);
        });
      },
      ledgerShippingAddresses: async (search, take) => {
        const contains = search ? this.buildContainsFilter(search) : undefined;
        const rows = await this.prisma.accShipAddr.findMany({
          where: {
            saaIsDeleted: false,
            saaIsActive: true,
            ...(contains
              ? {
                  OR: [
                    { saaTrdnm: contains },
                    { saaContactName: contains },
                    { ledger: { is: { ledName: contains } } },
                  ],
                }
              : {}),
          },
          select: {
            saaId: true,
            saaTrdnm: true,
            saaContactName: true,
            ledger: { select: { ledName: true } },
          },
          orderBy: [{ saaSort: 'asc' }, { saaId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) =>
          this.toOption(row.saaId, row.saaTrdnm ?? row.saaContactName ?? row.ledger?.ledName ?? row.saaId),
        );
      },
      employeeDepartments: this.simpleFetcher(
        (c, take) =>
          this.prisma.employeeDepartment.findMany({
            where: { edptIsDeleted: false, edptIsActive: true, ...c({ edptName: true }) },
            select: { edptId: true, edptName: true },
            orderBy: [{ edptName: 'asc' }, { edptId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.edptId, row.edptName),
      ),
      employeeDesignations: this.simpleFetcher(
        (c, take) =>
          this.prisma.employeeDesignation.findMany({
            where: { edIsDeleted: false, edIsActive: true, ...c({ edName: true }) },
            select: { edId: true, edName: true },
            orderBy: [{ edName: 'asc' }, { edId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.edId, row.edName),
      ),
      employees: this.simpleFetcher(
        (c, take) =>
          this.prisma.empMaster.findMany({
            where: { empIsDeleted: false, empIsActive: true, ...c({ empName: true }) },
            select: { empId: true, empName: true },
            orderBy: [{ empName: 'asc' }, { empId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.empId, row.empName),
      ),
      tenderTypes: this.simpleFetcher(
        (c, take) =>
          this.prisma.accountTenderTypes.findMany({
            where: {
              accttTypeIsDeleted: false,
              accttTypeIsActive: true,
              ...c({ accttTypeName: true }),
            },
            select: { accttTypeId: true, accttTypeName: true },
            orderBy: [{ accttTypeName: 'asc' }, { accttTypeId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(String(row.accttTypeId), row.accttTypeName),
      ),
      tenders: this.simpleFetcher(
        (c, take) =>
          this.prisma.accountTenderMaster.findMany({
            where: {
              acctndIsDeleted: false,
              acctndIsActive: true,
              ...c({ acctndName: true }),
            },
            select: { acctndId: true, acctndName: true },
            orderBy: [{ acctndName: 'asc' }, { acctndId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.acctndId, row.acctndName),
      ),
      gspProviders: this.simpleFetcher(
        (c, take) =>
          this.prisma.gspProviderMaster.findMany({
            where: { gspIsDeleted: false, gspIsActive: true, ...c({ gspProviderName: true }) },
            select: { gspProviderId: true, gspProviderName: true },
            orderBy: [{ gspProviderName: 'asc' }, { gspProviderId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.gspProviderId, row.gspProviderName),
      ),
      gspCompanyServices: async (search, take) => {
        const contains = search ? this.buildContainsFilter(search) : undefined;
        const rows = await this.prisma.gspCompanyService.findMany({
          where: {
            csgIsDeleted: false,
            csgIsActive: true,
            ...(contains
              ? {
                  OR: [{ csgServiceType: contains }, { company: { is: { compName: contains } } }],
                }
              : {}),
          },
          select: {
            csgCompanyServiceId: true,
            csgServiceType: true,
            company: { select: { compName: true } },
          },
          orderBy: [{ csgServiceType: 'asc' }, { csgCompanyServiceId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) =>
          this.toOption(row.csgCompanyServiceId, `${row.csgServiceType} - ${row.company.compName}`),
        );
      },
      itemGroups: this.simpleFetcher(
        (c, take) =>
          this.prisma.itemGroupMaster.findMany({
            where: { itgIsDeleted: false, itgIsActive: true, ...c({ itgName: true }) },
            select: { itgId: true, itgName: true },
            orderBy: [{ itgName: 'asc' }, { itgId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.itgId, row.itgName),
      ),
      itemCategories: this.simpleFetcher(
        (c, take) =>
          this.prisma.categoryMaster.findMany({
            where: { categoryIsDeleted: false, categoryIsActive: true, ...c({ categoryName: true }) },
            select: { categoryId: true, categoryName: true },
            orderBy: [{ categoryName: 'asc' }, { categoryId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.categoryId, row.categoryName),
      ),
      itemSections: this.simpleFetcher(
        (c, take) =>
          this.prisma.itemSectionMaster.findMany({
            where: { secIsDeleted: false, secIsActive: true, ...c({ secName: true }) },
            select: { secId: true, secName: true },
            orderBy: [{ secName: 'asc' }, { secId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.secId, row.secName),
      ),
      itemBrands: this.simpleFetcher(
        (c, take) =>
          this.prisma.itemBrandMaster.findMany({
            where: { brand_is_deleted: false, brand_is_active: true, ...c({ brand_name: true }) },
            select: { brand_id: true, brand_name: true },
            orderBy: [{ brand_name: 'asc' }, { brand_id: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.brand_id, row.brand_name),
      ),
      units: this.simpleFetcher(
        (c, take) =>
          this.prisma.unit.findMany({
            where: { unit_is_deleted: false, unit_is_active: true, ...c({ unit_name: true }) },
            select: { unit_id: true, unit_name: true },
            orderBy: [{ unit_name: 'asc' }, { unit_id: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.unit_id, row.unit_name),
      ),
      itemTaxes: this.simpleFetcher(
        (c, take) =>
          this.prisma.itemTaxMaster.findMany({
            where: { taxIsDeleted: false, taxIsActive: true, ...c({ taxName: true }) },
            select: { taxId: true, taxName: true },
            orderBy: [{ taxName: 'asc' }, { taxId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.taxId, row.taxName),
      ),
      priceLevels: async (search, take) => {
        const contains = search ? this.buildContainsFilter(search) : undefined;
        const rows = await this.prisma.priceLevel.findMany({
          where: {
            priceLvlIsDeleted: false,
            priceLvlIsActive: true,
            ...(contains
              ? {
                  OR: [{ priceLvlName: contains }, { priceLvlShort: contains }],
                }
              : {}),
          },
          select: { priceLvlId: true, priceLvlName: true, priceLvlShort: true },
          orderBy: [{ priceLvlName: 'asc' }, { priceLvlId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) =>
          this.toOption(String(row.priceLvlId), row.priceLvlName ?? row.priceLvlShort),
        );
      },
      hsnCodes: async (search, take) => {
        const contains = search ? this.buildContainsFilter(search) : undefined;
        const rows = await this.prisma.hsnMaster.findMany({
          where: {
            hsnIsActive: true,
            ...(contains
              ? {
                  OR: [{ hsnCode: contains }, { hsnName: contains }],
                }
              : {}),
          },
          select: { hsnCode: true, hsnId: true },
          orderBy: [{ hsnCode: 'asc' }, { hsnId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.hsnCode, row.hsnCode));
      },
      items: this.simpleFetcher(
        (c, take) =>
          this.prisma.itemMaster.findMany({
            where: {
              itemIsDeleted: false,
              itemIsActive: true,
              ...c({ OR: [{ itemNameEn: true }, { itemCode: true }, { itemAlias: true }] }),
            },
            select: { itemId: true, itemNameEn: true },
            orderBy: [{ itemNameEn: 'asc' }, { itemId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.itemId, row.itemNameEn),
      ),
      godownLocations: this.simpleFetcher(
        (c, take) =>
          this.prisma.godownLocation.findMany({
            where: { gdlIsDeleted: false, gdlIsActive: true, ...c({ gdlName: true }) },
            select: { gdlId: true, gdlName: true },
            orderBy: [{ gdlName: 'asc' }, { gdlId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.gdlId, row.gdlName),
      ),
      stateCodes: async (search, take) => {
        const contains = search ? this.buildContainsFilter(search) : undefined;
        const rows = await this.prisma.stateCode.findMany({
          where: {
            isDeleted: false,
            isActive: true,
            ...(contains
              ? {
                  OR: [{ stateCode: contains }, { stateName: contains }, { tinCode: contains }],
                }
              : {}),
          },
          select: { stateCode: true, stateName: true },
          orderBy: [{ stateName: 'asc' }, { stateCode: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.stateCode, row.stateName));
      },
      states: this.simpleFetcher(
        (c, take) =>
          this.prisma.stateMaster.findMany({
            where: { stmIsDeleted: false, stmIsActive: true, ...c({ stmName: true }) },
            select: { stmId: true, stmName: true },
            orderBy: [{ stmName: 'asc' }, { stmId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.stmId, row.stmName),
      ),
      cities: this.simpleFetcher(
        (c, take) =>
          this.prisma.cityMaster.findMany({
            where: { ctmIsDeleted: false, ctmIsActive: true, ...c({ ctmName: true }) },
            select: { ctmId: true, ctmName: true },
            orderBy: [{ ctmName: 'asc' }, { ctmId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.ctmId, row.ctmName),
      ),
      areas: this.simpleFetcher(
        (c, take) =>
          this.prisma.areaMaster.findMany({
            where: { armIsDeleted: false, armIsActive: true, ...c({ armName: true }) },
            select: { armId: true, armName: true },
            orderBy: [{ armName: 'asc' }, { armId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.armId, row.armName),
      ),
      customerGroups: this.simpleFetcher(
        (c, take) =>
          this.prisma.custGroup.findMany({
            where: {
              cgrIsDeleted: false,
              cgrIsActive: true,
              ...c({ OR: [{ cgrName: true }, { cgrAlias: true }] }),
            },
            select: { cgrId: true, cgrName: true, cgrAlias: true },
            orderBy: [{ cgrName: 'asc' }, { cgrId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.cgrId, row.cgrName ?? row.cgrAlias ?? row.cgrId),
      ),
      customers: this.simpleFetcher(
        (c, take) =>
          this.prisma.customer.findMany({
            where: {
              cusIsDeleted: false,
              cusIsActive: true,
              ...c({ OR: [{ cusName: true }, { cusCode: true }, { cusShort: true }] }),
            },
            select: { cusId: true, cusName: true },
            orderBy: [{ cusName: 'asc' }, { cusId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.cusId, row.cusName ?? row.cusId),
      ),
      supplierGroups: this.simpleFetcher(
        (c, take) =>
          this.prisma.supplierGroup.findMany({
            where: { spgIsDeleted: false, spgIsActive: true, ...c({ spgName: true }) },
            select: { spgId: true, spgName: true },
            orderBy: [{ spgName: 'asc' }, { spgId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.spgId, row.spgName),
      ),
      suppliers: this.simpleFetcher(
        (c, take) =>
          this.prisma.supplier.findMany({
            where: { supIsDeleted: false, supIsActive: true, ...c({ supName: true }) },
            select: { supId: true, supName: true },
            orderBy: [{ supName: 'asc' }, { supId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.supId, row.supName),
      ),
      userMasters: this.simpleFetcher(
        (c, take) =>
          this.prisma.userMaster.findMany({
            where: {
              usrIsDeleted: false,
              usrIsActive: true,
              ...c({ OR: [{ usrDisplayName: true }, { usrLoginName: true }] }),
            },
            select: { usrId: true, usrDisplayName: true },
            orderBy: [{ usrDisplayName: 'asc' }, { usrId: 'asc' }],
            ...take,
          }),
        (row) => this.toOption(row.usrId, row.usrDisplayName),
      ),
    };
  }
  /**
   * Factory for modules whose search target is a single name field (or a fixed OR clause).
   * `queryFn` receives:
   *   - `c` — a helper that returns `{ <field>: contains }` when a search term is present,
   *           or `{}` when it is not
   *   - `take` — a spread-ready `{ take }` object or `{}`
   */
  private simpleFetcher<T>(
    queryFn: (
      contains: (field: Record<string, unknown>) => Record<string, unknown>,
      take: Record<string, unknown>,
    ) => Promise<T[]>,
    mapper: (row: T) => NameIdOption,
  ): ModuleFetcher {
    return async (search, take) => {
      const filter = search ? this.buildContainsFilter(search) : undefined;
      const containsHelper = (field: Record<string, unknown>) =>
        filter ? this.applyContainsFilter(field, filter) : {};
      const takeArg = take ? { take } : {};
      const rows = await queryFn(containsHelper, takeArg);
      return rows.map(mapper);
    };
  }
  /**
   * Recursively walks a field selector object and replaces `true` leaf values
   * with the Prisma `contains` filter, preserving OR/AND/NOT wrappers.
   */
  private applyContainsFilter(
    field: Record<string, unknown>,
    contains: { contains: string; mode: 'insensitive' },
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(field).map(([key, value]) => {
        if (value === true) return [key, contains];
        if (Array.isArray(value)) {
          return [
            key,
            value.map((v) =>
              typeof v === 'object' && v !== null
                ? this.applyContainsFilter(v as Record<string, unknown>, contains)
                : v,
            ),
          ];
        }
        if (typeof value === 'object' && value !== null) {
          return [key, this.applyContainsFilter(value as Record<string, unknown>, contains)];
        }
        return [key, value];
      }),
    );
  }
  // ─── Core Fetch Logic ────────────────────────────────────────────────────────
  private async fetchModuleItems(
    module: LookupModuleKey,
    search: string | undefined,
    take: number | undefined,
    configuredDropdowns: Map<LookupModuleKey, DropdownLookupConfig>,
  ): Promise<NameIdOption[]> {
    const config = configuredDropdowns.get(module);
    if (config) {
      const configured = await this.tryFetchConfiguredModuleItems(config, search, take);
      if (configured !== null) return configured;
    }
    return this.moduleFetchers[module](search, take);
  }
  // ─── Dropdown Config Loading ─────────────────────────────────────────────────
  private async loadLookupDropdownConfigs(): Promise<Map<LookupModuleKey, DropdownLookupConfig>> {
    const records = await this.prisma.dropdownDetails.findMany({
      include: {
        dropdownColumns: { orderBy: [{ dropColumnsColumnNo: 'asc' }] },
      },
    });
    const configs = new Map<LookupModuleKey, DropdownLookupConfig>();
    for (const moduleKey of LOOKUP_MODULE_KEYS) {
      const record = this.findDropdownRecordForModule(moduleKey, records);
      if (!record) continue;
      configs.set(moduleKey, {
        dropdownId: record.dropdownId,
        dropdownName: record.dropdownName,
        dropdownSql: record.dropdownSql,
        dropdownSqlRegional: record.dropdownSqlRegional,
        dropdownSortColumn: record.dropdownSortColumn,
        dropdownSortOrder: record.dropdownSortOrder,
        dropdownColumns: record.dropdownColumns
          .filter((col) => col.dropColumnsColumnVisiblity)
          .map((col) => ({
            name: col.dropColumnsColumnName,
            alias: col.dropColumnsColumnAlias,
            filter: col.dropColumnsColumnFilter,
            visible: true,
          })),
      });
    }
    return configs;
  }
  private findDropdownRecordForModule(
    module: LookupModuleKey,
    records: DropdownRecord[],
  ): DropdownRecord | undefined {
    const aliases = new Set<string>([module, ...MODULE_DROPDOWN_NAME_ALIASES[module]]);
    const exactMatch = records.find((r) => aliases.has(r.dropdownName.trim()));
    if (exactMatch) return exactMatch;
    const normalizedAliases = Array.from(aliases).map((a) => this.normalizeLookupToken(a));
    return records.find((r) => normalizedAliases.includes(this.normalizeLookupToken(r.dropdownName)));
  }
  // ─── Configured SQL Fetching ─────────────────────────────────────────────────
  private async tryFetchConfiguredModuleItems(
    config: DropdownLookupConfig,
    search?: string,
    take?: number,
  ): Promise<NameIdOption[] | null> {
    const sqlCandidates = this.resolveConfiguredSqlCandidates(config);
    if (sqlCandidates.length === 0) return null;
    for (const sql of sqlCandidates) {
      try {
        const rows = await this.prisma.$queryRawUnsafe<LookupRow[]>(sql);
        return this.mapConfiguredRowsToOptions(rows, config.dropdownColumns, search, take, config);
      } catch {
        continue;
      }
    }
    return null;
  }
  private resolveConfiguredSqlCandidates(config: DropdownLookupConfig): string[] {
    const candidates = [config.dropdownSqlRegional, config.dropdownSql]
      .map((value) => this.normalizeConfiguredSql(value))
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(candidates));
  }
  private normalizeConfiguredSql(value: string | null | undefined): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim().replace(/;+$/g, '').trim();
    if (!trimmed) return undefined;
    if (!/^(select|with)\b/i.test(trimmed)) return undefined;
    if (trimmed.includes(';')) return undefined;
    const normalized = trimmed.replace(
      /,(\s*(from|where|group\s+by|order\s+by|having|union|limit|offset)\b)/gi,
      '$1',
    );
    // Reject SQL that would cause "syntax error at or near '.'" — a dot without a
    // column name after it, e.g. "t. FROM" produced by an incomplete alias reference.
    if (/\.\s*(from|where|group\s+by|order\s+by|having|union|limit|offset)\b/i.test(normalized)) {
      return undefined;
    }
    return this.normalizeConfiguredSqlTableReferences(normalized);
  }
  private normalizeConfiguredSqlTableReferences(sql: string): string {
    return CONFIGURED_SQL_TABLE_REPLACEMENTS.reduce(
      (current, [pattern, replacement]) => current.replace(pattern, replacement),
      sql,
    );
  }
  // ─── Configured Row Mapping ───────────────────────────────────────────────────
  private mapConfiguredRowsToOptions(
    rows: LookupRow[],
    columns: DropdownLookupColumnConfig[],
    search: string | undefined,
    take: number | undefined,
    config: DropdownLookupConfig,
  ): NameIdOption[] {
    const items = rows
      .map((row) => ({ row, option: this.mapConfiguredRowToOption(row, columns) }))
      .filter((item): item is { row: LookupRow; option: NameIdOption } => item.option !== null)
      .filter((item) => this.matchesConfiguredSearch(item, search, columns))
      .sort((a, b) => this.compareConfiguredRows(a, b, config))
      .map((item) => item.option);
    return take ? items.slice(0, take) : items;
  }
  private mapConfiguredRowToOption(
    row: LookupRow,
    columns: DropdownLookupColumnConfig[],
  ): NameIdOption | null {
    const rowKeys = this.resolveRowLookupKeys(row);
    const configuredKeys = this.resolveConfiguredLookupKeys(columns);
    const idKey = this.resolveLikelyIdKey(rowKeys) ?? this.resolveLikelyIdKey(configuredKeys);
    const idValue = idKey ? this.readLookupRowValue(row, idKey) : undefined;
    if (!idValue) return null;
    const nameKey =
      this.resolveLikelyNameKey(rowKeys, idKey, false) ??
      this.resolveLikelyNameKey(configuredKeys, idKey, false);
    const nameValue = nameKey ? this.readLookupRowValue(row, nameKey) : undefined;
    return this.toOption(idValue, nameValue, { fallbackNameToId: false });
  }
  private matchesConfiguredSearch(
    item: { row: LookupRow; option: NameIdOption },
    search: string | undefined,
    columns: DropdownLookupColumnConfig[],
  ): boolean {
    if (!search) return true;
    const filterableKeys = new Set(
      columns
        .filter((col) => col.filter)
        .flatMap((col) => [col.name, col.alias].filter((v): v is string => Boolean(v)))
        .map((v) => this.normalizeLookupToken(v)),
    );
    const extraValues =
      filterableKeys.size > 0
        ? Object.entries(item.row)
            .filter(([key]) => filterableKeys.has(this.normalizeLookupToken(key)))
            .map(([, v]) => this.toLookupValue(v))
            .filter((v): v is string => Boolean(v))
        : [];
    const haystack = [item.option.id, item.option.name, ...extraValues]
      .join(' ')
      .toLowerCase();
    return haystack.includes(search.toLowerCase());
  }
  private compareConfiguredRows(
    left: { row: LookupRow; option: NameIdOption },
    right: { row: LookupRow; option: NameIdOption },
    config: DropdownLookupConfig,
  ): number {
    const sortOrder = config.dropdownSortOrder?.trim().toUpperCase() === 'DESC' ? -1 : 1;
    const sortColumnKey = this.normalizeLookupToken(config.dropdownSortColumn ?? '');
    const useSortColumn =
      sortColumnKey !== '' &&
      (this.readLookupRowValue(left.row, sortColumnKey) !== undefined ||
        this.readLookupRowValue(right.row, sortColumnKey) !== undefined);
    const leftValue = useSortColumn
      ? this.readLookupRowValue(left.row, sortColumnKey)
      : left.option.name;
    const rightValue = useSortColumn
      ? this.readLookupRowValue(right.row, sortColumnKey)
      : right.option.name;
    const primary = (leftValue ?? '').localeCompare(rightValue ?? '', undefined, {
      sensitivity: 'base',
      numeric: true,
    });
    if (primary !== 0) return primary * sortOrder;
    return left.option.id.localeCompare(right.option.id, undefined, {
      sensitivity: 'base',
      numeric: true,
    });
  }
  // ─── Key / Value Helpers ─────────────────────────────────────────────────────
  private resolveConfiguredLookupKeys(columns: DropdownLookupColumnConfig[]): string[] {
    const seen = new Set<string>();
    const keys: string[] = [];
    for (const col of columns) {
      for (const raw of [col.name, col.alias]) {
        const normalized = this.normalizeLookupToken(raw);
        if (normalized && !seen.has(normalized)) {
          seen.add(normalized);
          keys.push(normalized);
        }
      }
    }
    return keys;
  }
  private resolveRowLookupKeys(row: LookupRow): string[] {
    const seen = new Set<string>();
    const keys: string[] = [];
    for (const key of Object.keys(row)) {
      const normalized = this.normalizeLookupToken(key);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        keys.push(normalized);
      }
    }
    return keys;
  }
  private resolveLikelyIdKey(keys: string[]): string | undefined {
    return keys.find((k) => this.isLikelyIdKey(k)) ?? keys[0];
  }
  private resolveLikelyNameKey(
    keys: string[],
    idKey?: string,
    fallbackToId = true,
  ): string | undefined {
    return (
      keys.find((k) => k !== idKey && this.isLikelyNameKey(k)) ??
      keys.find((k) => k !== idKey) ??
      (fallbackToId ? idKey : undefined)
    );
  }
  private readLookupRowValue(row: LookupRow, normalizedKey: string): string | undefined {
    for (const [actualKey, value] of Object.entries(row)) {
      if (this.normalizeLookupToken(actualKey) === normalizedKey) {
        return this.toLookupValue(value);
      }
    }
    return undefined;
  }
  private toLookupValue(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed || undefined;
    }
    if (typeof value === 'number' || typeof value === 'bigint') return String(value);
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return undefined;
  }
  private isLikelyIdKey(value: string): boolean {
    const tokens = value.split(' ').filter(Boolean);
    return tokens.includes('id') || tokens.includes('uuid') || tokens.includes('value');
  }
  private isLikelyNameKey(value: string): boolean {
    const tokens = value.split(' ').filter(Boolean);
    return (
      tokens.includes('name') ||
      tokens.includes('label') ||
      tokens.includes('title') ||
      tokens.includes('alias') ||
      tokens.includes('short') ||
      tokens.includes('description')
    );
  }
  private normalizeLookupToken(value: string | null | undefined): string {
    if (!value) return '';
    return value
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((t) => t && !LOOKUP_NAME_NOISE_TOKENS.has(t))
      .join(' ');
  }
  // ─── Misc Helpers ────────────────────────────────────────────────────────────
  private toOption(
    id: string,
    name: string | null | undefined,
    options?: { fallbackNameToId?: boolean },
  ): NameIdOption {
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const fallbackNameToId = options?.fallbackNameToId ?? true;
    return {
      id,
      name: normalizedName || (fallbackNameToId ? id : ''),
    };
  }
  private toSingleModulePayload(
    module: LookupModuleKey,
    items: NameIdOption[],
  ): SingleModuleLookupPayload {
    const scope = ACCOUNT_LOOKUP_MODULE_KEYS.includes(module as AccountsLookupModuleKey)
      ? 'accounts'
      : 'masters';
    return { scope, module, items };
  }
  private normalizeSearch(search?: string): string | undefined {
    return search?.trim() || undefined;
  }
  private resolveTake(search: string | undefined, limit?: number): number | undefined {
    if (limit !== undefined) {
      const clamped = Math.max(1, Math.min(Math.trunc(limit), MAX_LOOKUP_LIMIT));
      return clamped;
    }
    return search ? DEFAULT_SEARCH_LIMIT : undefined;
  }
  private buildContainsFilter(search: string): { contains: string; mode: 'insensitive' } {
    return { contains: search, mode: 'insensitive' };
  }
}