import { Injectable } from '@nestjs/common';
import { ItemPriceMaster, Prisma } from '@prisma/client';

/**
 * item_price_master.ipm_uc_unit_id is a FK to item_unit_conversion(iuc_id), not a
 * raw unit_id, so every price row is loaded with its conversion: iucUnitId is
 * the unit that stock, reorder and the response payload are keyed by.
 */
type PriceRowWithUnit = Prisma.ItemPriceMasterGetPayload<{
  include: { itemUnitConversion: { include: { unit: true } } };
}>;
import { PgService } from '../../database/pg/pg.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  MasterErrorDetail,
  throwMasterNotFound,
  toNullableNumber,
  toNumber,
} from '../../common/utils/module-service.utils';
import { CustomerDetailQueryDto } from './dto/customer-detail-query.dto';
import { ItemPriceLookupQueryDto } from './dto/item-price-lookup-query.dto';
import {
  ACCOUNT_LOOKUP_MODULE_KEYS,
  AccountsLookupModuleKey,
  BarcodeItemLookup,
  CustomerDetail,
  FiscalYearOption,
  FreightChargeOption,
  ItemPriceLookupPayload,
  LookupModuleKey,
  LOOKUP_MODULE_ALIASES,
  LOOKUP_MODULE_KEYS,
  MASTER_LOOKUP_MODULE_KEYS,
  MasterLookupDataPayload,
  NameIdOption,
  SingleModuleLookupPayload,
} from './types/master-lookup-api.types';
// ─── Constants ───────────────────────────────────────────────────────────────
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
type ModuleFetcher = () => Promise<NameIdOption[]>;
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
    dropdownColumnsNo: number;
    dropdownColumnsName: string;
    dropdownColumnsAlias: string | null;
    dropdownColumnsFilter: boolean;
    dropdownColumnsVisiblity: boolean;
  }>;
};
// ─── Service ──────────────────────────────────────────────────────────────────
@Injectable()
export class MasterLookupService {
  private readonly moduleFetchers: Record<LookupModuleKey, ModuleFetcher>;
  constructor(
    private readonly prisma: PrismaService,
    private readonly pg: PgService,
  ) {
    this.moduleFetchers = this.buildModuleFetchers();
  }
  // ─── Public API ─────────────────────────────────────────────────────────────
  async getAllAccountsAndMasterNameIds(module?: LookupModuleKey): Promise<MasterLookupDataPayload> {
    const configuredDropdowns = await this.loadLookupDropdownConfigs();
    if (module) {
      const items = await this.fetchModuleItems(module, configuredDropdowns);
      return this.toSingleModulePayload(module, items);
    }
    const entries = await Promise.all(
      LOOKUP_MODULE_KEYS.map(async (key) => [
        key,
        await this.fetchModuleItems(key, configuredDropdowns),
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
  async getAllMasters(module?: LookupModuleKey): Promise<NameIdOption[]> {
    const configuredDropdowns = await this.loadLookupDropdownConfigs();
    const MASTER_KEYS: LookupModuleKey[] = module
      ? [module]
      : (MASTER_LOOKUP_MODULE_KEYS as any);
    const entries = await Promise.all(
      MASTER_KEYS.map(async (key: LookupModuleKey) => [
        key,
        await this.fetchModuleItems(key, configuredDropdowns),
      ]),
    );
    const byModule = Object.fromEntries(entries) as Record<string, NameIdOption[]>;
    return Object.values(byModule).flat().map((item) => ({
      id: item.id,
      name: item.name,
    }));
  }
  async getBranchesByCompany(companyId: string): Promise<NameIdOption[]> {
    const rows = await this.prisma.branchMaster.findMany({
      where: {
        brCompId: companyId,
        brIsDeleted: false,
        brIsActive: true,
      },
      select: { brId: true, brName: true },
      orderBy: [{ brName: 'asc' }, { brId: 'asc' }],
    });
    return rows.map((row) => this.toOption(row.brId, row.brName));
  }
  async getFiscalYearsByCompany(companyId: string): Promise<FiscalYearOption[]> {
    const rows = await this.prisma.fiscalYear.findMany({
      where: {
        compId: companyId,
        isDeleted: false,
      },
      select: {
        fyId: true,
        fyYearName: true,
        fyBeginDate: true,
        fyEndDate: true,
        fyStatus: true,
        fyIsCurrent: true,
      },
      orderBy: [{ fyIsCurrent: 'desc' }, { fyBeginDate: 'desc' }, { fyId: 'desc' }],
    });
    return rows.map((row) => ({
      id: row.fyId,
      name: row.fyYearName.trim(),
      beginDate: this.toDateOnly(row.fyBeginDate),
      endDate: this.toDateOnly(row.fyEndDate),
      status: row.fyStatus,
      isCurrent: row.fyIsCurrent,
    }));
  }
  /**
   * Legacy `iflag = 9`: the active freight-charge slabs whose km range covers the
   * given distance (distance BETWEEN fr_from_km AND fr_to_km).
   */
  async getFreightChargesForDistance(distance: number): Promise<FreightChargeOption[]> {
    const rows = await this.prisma.freightCharges.findMany({
      where: {
        frIsDeleted: false,
        frIsActive: true,
        frFromKm: { lte: distance },
        frToKm: { gte: distance },
      },
      orderBy: [{ frFromKm: 'asc' }, { frFromWeight: 'asc' }],
    });
    return rows.map((row) => this.toFreightChargeOption(row));
  }
  /**
   * Legacy `iflag = 10` (barcode): resolve a scanned EAN code to its item and
   * selling unit. Matches item_ean_codes.ean_code case-insensitively (legacy
   * `lower(ean_code) = lower(...)`) among active, non-deleted codes. The legacy
   * `item_comp_id IN (0, icompany_id)` scope is dropped — lookup is by barcode
   * only. Returns the sales flags the POS needs (allow_sales, item_status, etc.).
   */
  async getItemByBarcode(barcode: string): Promise<BarcodeItemLookup> {
    const code = barcode.trim();
    const ean = await this.prisma.itemEanCode.findFirst({
      where: {
        eanIsActive: true,
        eanIsDeleted: false,
        eanCode: { equals: code, mode: 'insensitive' },
      },
      select: { eanItemId: true, eanUcUnitId: true },
    });
    if (!ean) {
      throwMasterNotFound<MasterErrorDetail>(
        'Barcode not found',
        'barcode',
        `No active item found for barcode ${code}`,
      );
    }
    // Legacy INNER JOIN item_master ON item_id = ean.item_id.
    const item = await this.prisma.itemMaster.findFirst({
      where: { itemId: ean.eanItemId },
      select: {
        itemNameEn: true,
        itemBatchConfig: true,
        itemAllowSales: true,
        itemIsActive: true,
        itemWeighScale: true,
      },
    });
    if (!item) {
      throwMasterNotFound<MasterErrorDetail>(
        'Barcode not found',
        'barcode',
        `Barcode ${code} is not linked to a valid item`,
      );
    }
    return {
      itemId: ean.eanItemId,
      unitId: ean.eanUcUnitId,
      itemName: item.itemNameEn,
      batchConfig: item.itemBatchConfig,
      allowSales: item.itemAllowSales,
      itemStatus: item.itemIsActive,
      weighScale: item.itemWeighScale,
    };
  }
  /**
   * Port of the legacy PL/pgSQL `iflag = 7` customer-detail cursor onto the
   * current UUID schema. Resolves one customer (legacy isale_cust_id) within a
   * company (legacy icompany_id) into a single flat row.
   *
   * Legacy behaviour reproduced here:
   *  - salesman (legacy `default_salesman[1]` ⋈ employee_master): the scalar
   *    `cus_default_salesman` is joined to employee_master (emp_id) to resolve
   *    the salesman name.
   *  - name/address (legacy `iregional`): regional=true returns the
   *    regional-language fields (falling back to English), else the English ones.
   *  - `tcs_customer`: true only when the customer's IT-collection type is TCS
   *    and it is not exempted.
   *  - `local_sales`: true when the customer and company share a state code.
   *  - `billed_date`: "<n> days : dd/MM/yy" built from the last billed date.
   *
   * Schema divergences from the legacy query:
   *  - the legacy debit_* credit-control fields are the current cus_credit_*
   *    columns (debit_days → cus_credit_days, debit_limit → cus_credit_amt_limit,
   *    debit_allowed → cus_credit_allowed).
   *  - loyalty points (legacy LOYCRD.cust_points) are not modelled yet → null.
   *  - the legacy `cust_pan` literal is derived from PAN presence.
   */
  async getCustomerDetail(query: CustomerDetailQueryDto): Promise<CustomerDetail> {
    const { cus_id, company_id } = query;
    const regional = query.regional ?? false;
    // Customer + its area (legacy INNER JOIN area_master for distance_km).
    const customer = await this.prisma.customer.findFirst({
      where: { cusId: cus_id, cusIsDeleted: false },
      include: { area: { select: { armName: true, armDistanceKm: true } } },
    });
    if (!customer) {
      throwMasterNotFound<MasterErrorDetail>(
        'Customer not found',
        'cus_id',
        `No active customer found for id ${cus_id}`,
      );
    }
    // Company (legacy INNER JOIN companys ON comp_id = icompany_id) and the
    // salesman (legacy default_salesman[1] ⋈ employee_master).
    const [company, salesman] = await Promise.all([
      this.prisma.company.findFirst({
        where: { compId: company_id },
        select: { compTcsApplicable: true, compStateCode: true },
      }),
      customer.cusDefaultSalesman
        ? this.prisma.employeeMaster.findFirst({
            where: { empId: customer.cusDefaultSalesman, empIsDeleted: false },
            select: { empName: true },
          })
        : Promise.resolve(null),
    ]);
    // Legacy `iregional`: regional name/address fall back to English when unset.
    const custName = regional ? (customer.cusRegionName ?? customer.cusName) : customer.cusName;
    const custAddress = regional
      ? (customer.cusRegionAddr1 ?? customer.cusAddr1)
      : customer.cusAddr1;
    const custPlace = regional ? (customer.cusRegionAddr2 ?? customer.cusAddr2) : customer.cusAddr2;
    return {
      cust_id: customer.cusId,
      cust_name: custName ?? '',
      cust_address: custAddress ?? null,
      cust_place: custPlace ?? null,
      cust_ename: customer.cusName,
      cust_eadd1: customer.cusAddr1,
      cust_eadd2: customer.cusAddr2,
      cust_eadd3: customer.cusAddr3,
      cust_pin: customer.cusPin,
      ecommerce_gstin: customer.cusEcommerceGstin,
      gst_no: customer.cusGstNo,
      gst_type: customer.cusGstType,
      state_code: customer.cusStateCode,
      state_name: customer.cusStateName,
      area_id: customer.cusAreaId,
      area_name: customer.area?.armName ?? null,
      distance_km: customer.area?.armDistanceKm ?? null,
      cust_phone1: customer.cusPhone1,
      // Legacy debit_* credit-control fields → current cus_credit_* columns.
      debit_days: customer.cusCreditDays,
      debit_limit: toNumber(customer.cusCreditAmtLimit),
      debit_allowed: customer.cusCreditAllowed,
      freight_charge: customer.cusFreightCharge,
      cooly: customer.cusLoadingCharge,
      unloading_charge: customer.cusUnloadingCharge,
      allow_promotion: customer.cusAllowPromotion,
      allow_loyalty: customer.cusAllowLoyalty,
      allow_discount: customer.cusAllowDiscount,
      overdue_billing: customer.cusOverdueBilling,
      price_level: customer.cusPriceLevelId,
      cust_disc_perc: toNumber(customer.cusDiscPerc),
      salesman_id: customer.cusDefaultSalesman,
      salesman_name: salesman?.empName ?? null,
      tcs_company: company?.compTcsApplicable ?? false,
      // Legacy: TCS applies only when the IT-collection type is TCS and unexempted.
      tcs_customer: customer.cusItcollType === 'TCS' && customer.cusItcollExempted === false,
      cust_pan: Boolean(customer.cusPanNo),
      // Legacy `local_sales`: customer and company in the same state.
      local_sales: !!company && customer.cusStateCode === company.compStateCode,
      cust_points: null,
      billed_date: this.formatBilledDate(customer.cusBilledDate),
    };
  }
  /**
   * Port of the legacy PL/pgSQL `getItemForSale` cursor onto the current UUID
   * schema. It resolves one item + one unit rate into a single flat row: the
   * effective price for the requested price level, the tax block, stock,
   * reorder level, negative-stock rule and the quantity-wise rate list.
   *
   * Legacy workflow faithfully reproduced here:
   *  - unit-rate pick (legacy `ivoucher_no` / `unit_slno`): an explicit unit_id
   *    wins; otherwise the unit-slno rule applies — a retail item takes the
   *    highest slno row, a non-retail item takes the base row (slno 0).
   *  - godown (legacy `isale_no`): an explicit godown_id overrides the rate's
   *    own godown for both the godown row and the stock scope.
   *  - stock (legacy `ienable_loading`): when enable_loading is set, stock is
   *    summed across ALL godowns; otherwise it is scoped to the resolved godown.
   *  - customer rate (legacy `CSR.csr_disc_qty`): the customer discount is
   *    subtracted ONLY from the A/B/C/D sales prices (levels 1–4), never from
   *    max/min/cost (levels 5/6/7).
   *  - name (legacy `iregional`): regional=true returns item_name_ta, else the
   *    English name.
   *
   * Schema divergences from the legacy query:
   *  - customer rates / qty-wise rates now hang off the pricing hub
   *    `item_price_master` (ipm_id) instead of (item_id, unit_id).
   *  - price level is the legacy 1–7 scheme: 1=A, 2=B, 3=C, 4=D, 5=MRP/max,
   *    6=min, 7=cost — any of the seven columns is selectable.
   *  - the item-group price-level scheme discount has no column → `sch_discount`
   *    is always null.
   */
  async getItemPriceLookup(query: ItemPriceLookupQueryDto): Promise<ItemPriceLookupPayload> {
    const { item_id, unit_id, company_id, branch_id, customer_id, acccyear } = query;
    const priceLevel = query.price_level;
    const enableLoading = query.enable_loading ?? false;
    const regional = query.regional ?? false;

    // 1. Item + candidate unit-rate rows (legacy: item_master ⋈ item_unit_rates).
    const [itemRecord, priceRows] = await Promise.all([
      this.prisma.itemMaster.findFirst({
        where: {
          itemId: item_id,
          itemBranchId: branch_id,
          itemIsDeleted: false,
        },
      }),
      this.prisma.itemPriceMaster.findMany({
        where: {
          ipmItemId: item_id,
          ipmBranchId: branch_id,
          ipmIsDeleted: false,
        },
        include: { itemUnitConversion: { include: { unit: true } } },
        orderBy: [{ itemUnitConversion: { iucUnitSlno: 'asc' } }],
      }),
    ]);
    if (!itemRecord) {
      throwMasterNotFound<MasterErrorDetail>(
        'Item not found',
        'item_id',
        `No active item found for id ${item_id}`,
      );
    }

    // 2. Pick the unit rate: an explicit unit wins, otherwise the legacy
    //    unit-slno rule (retail item → highest slno, else base row, slno 0).
    const rate = this.selectUnitRate(priceRows, itemRecord.itemRetailItem, unit_id);
    if (!rate) {
      throwMasterNotFound<MasterErrorDetail>(
        'Item price not found',
        unit_id ? 'unit_id' : 'item_id',
        unit_id
          ? `No active price row found for item ${item_id} and unit ${unit_id}`
          : `No active price row configured for item ${item_id}`,
      );
    }

    // Legacy `isale_no`: an explicit sale godown overrides the rate's own godown.
    const godownId = query.godown_id ?? rate.ipmGodownId;

    // 3. Everything that hangs off the chosen item / rate (legacy lateral joins).
    // The rate's unit now arrives with the row, via its conversion.
    const unit = rate.itemUnitConversion.unit;
    const rateUnitId = rate.itemUnitConversion.iucUnitId;
    const [godown, tax, company, custRate, reorder, stockSum] = await Promise.all([
      godownId
        ? this.prisma.godownLocation.findFirst({ where: { gdlId: godownId } })
        : Promise.resolve(null),
      itemRecord.itemDefaultTaxId
        ? this.prisma.itemTaxMaster.findFirst({
            where: { taxId: itemRecord.itemDefaultTaxId, taxIsDeleted: false },
          })
        : Promise.resolve(null),
      this.prisma.company.findFirst({ where: { compId: company_id } }),
      customer_id
        ? this.prisma.custItemRate.findFirst({
            where: {
              csrUnitRateId: rate.ipmId,
              csrCustomerId: customer_id,
              csrIsDeleted: false,
              csrIsActive: true,
            },
          })
        : Promise.resolve(null),
      // ir_unit_id and ipm_uc_unit_id both hold an iuc_id, so these match directly.
      this.prisma.itemReorder.findFirst({
        where: { irItemId: item_id, irUcUnitId: rate.ipmUcUnitId, irIsDeleted: false },
      }),
      acccyear
        ? this.prisma.itemStockBalance.aggregate({
            _sum: { isbClosingQty: true },
            where: {
              isbAccYear: acccyear,
              isbItemId: item_id,
              // isb_unit_id holds a raw unit_id, so the conversion's unit.
              isbUnitId: rateUnitId,
              isbCompanyId: company_id,
              isbBranchId: branch_id,
              // Legacy `ienable_loading`: loading mode sums across all godowns;
              // otherwise stock is scoped to the resolved godown.
              // A godown-less price row is not godown-scoped, so its stock sums
              // across all godowns exactly as loading mode does.
              ...(enableLoading || !godownId ? {} : { isbGodownId: godownId }),
            },
          })
        : Promise.resolve(null),
    ]);

    // 4. Derived values.
    const gstApplicable = company?.compGstApplicable ?? false;
    const basePrice = this.priceForLevel(rate, priceLevel);
    // Legacy: the customer rate discount applies ONLY to the A/B/C/D sales
    // prices (levels 1–4), never to max/min/cost (levels 5/6/7).
    const customerDiscQty =
      custRate && priceLevel >= 1 && priceLevel <= 4 ? toNumber(custRate.csrDiscQty) : 0;
    const salesPrice = basePrice - customerDiscQty;

    // Legacy `iregional`: regional name falls back to English when unset.
    const itemName = regional
      ? (itemRecord.itemNameTa ?? itemRecord.itemNameEn)
      : itemRecord.itemNameEn;

    const stock = stockSum ? toNullableNumber(stockSum._sum.isbClosingQty ?? 0) : null;
    const reorderQty = reorder ? toNumber(reorder.irMinLevel) - (stock ?? 0) : null;

    // Legacy allow_negative_stock: service items always allow; otherwise it is
    // blocked only when godown, company and item all disallow it.
    const allowNegativeStock = itemRecord.itemIsService
      ? true
      : !(
          godown?.gdlNegativeStock === false &&
          company?.compNegStkApl === false &&
          itemRecord.itemAllowNegStock === false
        );

    return {
      item_id: itemRecord.itemId,
      unit_id: rateUnitId,
      unit_rate_id: rate.ipmId,
      godown_id: godownId ?? null,
      godown_name: godown?.gdlName ?? '',

      item_code: itemRecord.itemCode,
      item_name: itemName,
      item_com_code: itemRecord.itemSku,
      barcode: itemRecord.itemDefaultBarcode,

      allow_promo: itemRecord.itemAllowPromo,
      add_freight: itemRecord.itemAllowFreight,
      item_group_id: itemRecord.itemGroupId,
      item_category_id: itemRecord.itemCategoryId,
      weigh_scale: itemRecord.itemWeighScale,
      batch_config: itemRecord.itemBatchConfig,
      service_item: itemRecord.itemIsService ? 'Y' : 'N',
      allow_negative_stock: allowNegativeStock,

      price_level: priceLevel,
      sales_price: salesPrice,
      cost_price: toNumber(rate.ipmCostPrice),
      cost_wot: toNumber(rate.ipmCostWot),
      min_price: toNumber(rate.ipmMinPrice),
      max_price: toNumber(rate.ipmMaxPrice),
      disc_perc: toNumber(rate.ipmDiscPerc),
      disc_qty: toNumber(rate.ipmDiscQty),
      sch_discount: null,
      addl_cess: toNumber(rate.ipmAddlCess),

      unit_desc: unit?.unit_description ?? null,
      unit_weight: toNullableNumber(unit?.unit_weight ?? null) ?? 0,
      unit_loading: itemRecord.itemAllowLoading
        ? (toNullableNumber(unit?.unit_loading ?? null) ?? 0)
        : 0,
      decimal_count: unit?.unit_decimal_count ?? 0,

      loyalty_pv: itemRecord.itemAllowLoyalty ? toNumber(rate.ipmLoyaltyPoints) : 0,

      stock,
      reorder_qty: reorderQty,

      gst_rate: gstApplicable && tax ? toNumber(tax.taxGstRateTotal) : 0,
      cess_perc: gstApplicable && tax ? toNumber(tax.taxCessPerc) : 0,
      cess_unit: gstApplicable && tax ? toNumber(tax.taxCessUnit) : 0,
      sgst_perc: gstApplicable && tax ? toNumber(tax.taxSgstPerc) : 0,
      cgst_perc: gstApplicable && tax ? toNumber(tax.taxCgstPerc) : 0,
      igst_perc: gstApplicable && tax ? toNumber(tax.taxIgstPerc) : 0,
      sales_ledger_id: tax?.taxSalesLedgerId ?? null,
      sgst_output_ledger_id: tax?.taxSgstOutputLedgerId ?? null,
      cgst_output_ledger_id: tax?.taxCgstOutputLedgerId ?? null,
      igst_output_ledger_id: tax?.taxIgstOutputLedgerId ?? null,
      cess_output_ledger_id: tax?.taxCessOutputLedgerId ?? null,
    };
  }
  /**
   * Unit-rate selection (legacy WHERE clause). An explicit unit wins. Otherwise
   * the unit-slno rule applies: a retail item takes the row with the highest
   * slno (largest pack), a non-retail item takes the base row (slno 0). Returns
   * null when nothing matches.
   */
  private selectUnitRate(
    priceRows: PriceRowWithUnit[],
    isRetailItem: boolean,
    unitId?: string,
  ): PriceRowWithUnit | null {
    if (priceRows.length === 0) return null;
    if (unitId) {
      // Callers pass a unit_id, which the row now holds only via its conversion;
      // an iuc_id still matches so an internal caller can pass either.
      return (
        priceRows.find(
          (row) => row.itemUnitConversion.iucUnitId === unitId || row.ipmUcUnitId === unitId,
        ) ?? null
      );
    }
    // The unit slno the legacy rule keys off lives on the conversion row now.
    if (isRetailItem) {
      return priceRows.reduce(
        (best, row) =>
          row.itemUnitConversion.iucUnitSlno > best.itemUnitConversion.iucUnitSlno ? row : best,
        priceRows[0],
      );
    }
    return priceRows.find((row) => row.itemUnitConversion.iucUnitSlno === 0) ?? null;
  }
  /** Legacy price-level CASE (1–7 → a/b/c/d/max/min/cost). */
  private priceForLevel(rate: ItemPriceMaster, priceLevel: number): number {
    switch (priceLevel) {
      case 2:
        return toNumber(rate.ipmSalesPriceB);
      case 3:
        return toNumber(rate.ipmSalesPriceC);
      case 4:
        return toNumber(rate.ipmSalesPriceD);
      case 5:
        return toNumber(rate.ipmMaxPrice);
      case 6:
        return toNumber(rate.ipmMinPrice);
      case 7:
        return toNumber(rate.ipmCostPrice);
      case 1:
      default:
        return toNumber(rate.ipmSalesPriceA);
    }
  }
  async getDropdownSqlData(dropdownId: number): Promise<NameIdOption[]> {
    const record = await this.prisma.dropdownDetails.findUnique({
      where: { dropdownId },
      include: { dropdownColumns: { orderBy: [{ dropdownColumnsNo: 'asc' }] } },
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
        .filter((col: any) => col.dropdownColumnsVisiblity)
        .map((col: any) => ({
          name: col.dropdownColumnsName,
          alias: col.dropdownColumnsAlias,
          filter: col.dropdownColumnsFilter,
          visible: true,
        })),
    };
    return (await this.tryFetchConfiguredModuleItems(config)) ?? [];
  }
  // ─── Module Fetcher Registry ─────────────────────────────────────────────────
  /**
   * Builds the registry of per-module table fetchers.
   * Simple modules (single name field) use `simpleFetcher`; complex ones are inlined.
   */
  private buildModuleFetchers(): Record<LookupModuleKey, ModuleFetcher> {
    return {
      companies: this.simpleFetcher(
        () =>
          this.prisma.company.findMany({
            where: { compIsDeleted: false, compIsActive: true },
            select: { compId: true, compName: true },
            orderBy: [{ compName: 'asc' }, { compId: 'asc' }],
          }),
        (row) => this.toOption(row.compId, row.compName),
      ),
      companyGroups: this.simpleFetcher(
        () =>
          this.prisma.companyGroupMaster.findMany({
            where: { cogIsDeleted: false, cogIsActive: true },
            select: { cogGroupId: true, cogGroupName: true },
            orderBy: [{ cogGroupName: 'asc' }, { cogGroupId: 'asc' }],
          }),
        (row) => this.toOption(row.cogGroupId, row.cogGroupName),
      ),
      branches: this.simpleFetcher(
        () =>
          this.prisma.branchMaster.findMany({
            where: { brIsDeleted: false, brIsActive: true },
            select: { brId: true, brName: true },
            orderBy: [{ brName: 'asc' }, { brId: 'asc' }],
          }),
        (row) => this.toOption(row.brId, row.brName),
      ),
      accountGroups: this.simpleFetcher(
        () =>
          this.prisma.accountGroup.findMany({
            where: { accGroupIsDeleted: false, accGroupIsActive: true },
            select: { accGroupId: true, accGroupName: true },
            orderBy: [{ accGroupName: 'asc' }, { accGroupId: 'asc' }],
          }),
        (row) => this.toOption(row.accGroupId, row.accGroupName),
      ),
      accountLedgers: this.simpleFetcher(
        () =>
          this.prisma.accLedgerMaster.findMany({
            where: {
              ledIsDeleted: false,
              ledIsActive: true,
            },
            select: { ledId: true, ledName: true },
            orderBy: [{ ledName: 'asc' }, { ledId: 'asc' }],
          }),
        (row) => this.toOption(row.ledId, row.ledName),
      ),
      ledgerBankAccounts: async () => {
        const rows = await this.prisma.accLedgerBankAccount.findMany({
          where: {
            lbaIsDeleted: false,
            lbaIsActive: true,
          },
          select: {
            lbaId: true,
            lbaAccountHolder: true,
            lbaAccountNo: true,
            ledger: { select: { ledName: true } },
          },
          orderBy: [{ lbaAccountHolder: 'asc' }, { lbaId: 'asc' }],
        });
        return rows.map((row) => {
          const ledgerSuffix = row.ledger?.ledName ? ` - ${row.ledger.ledName}` : '';
          return this.toOption(row.lbaId, `${row.lbaAccountHolder} (${row.lbaAccountNo})${ledgerSuffix}`);
        });
      },
      ledgerShippingAddresses: async () => {
        const rows = await this.prisma.accShipAddr.findMany({
          where: {
            saaIsDeleted: false,
            saaIsActive: true,
          },
          select: {
            saaId: true,
            saaTradeName: true,
            saaContactName: true,
            ledger: { select: { ledName: true } },
          },
          orderBy: [{ saaSort: 'asc' }, { saaId: 'asc' }],
        });
        return rows.map((row) =>
          this.toOption(row.saaId, row.saaTradeName ?? row.saaContactName ?? row.ledger?.ledName ?? row.saaId),
        );
      },
      employeeDepartments: this.simpleFetcher(
        () =>
          this.prisma.employeeDepartment.findMany({
            where: { edptIsDeleted: false, edptIsActive: true },
            select: { edptId: true, edptName: true },
            orderBy: [{ edptName: 'asc' }, { edptId: 'asc' }],
          }),
        (row) => this.toOption(row.edptId, row.edptName),
      ),
      employeeDesignations: this.simpleFetcher(
        () =>
          this.prisma.employeeDesignation.findMany({
            where: { edIsDeleted: false, edIsActive: true },
            select: { edId: true, edName: true },
            orderBy: [{ edName: 'asc' }, { edId: 'asc' }],
          }),
        (row) => this.toOption(row.edId, row.edName),
      ),
      employees: this.simpleFetcher(
        () =>
          this.prisma.employeeMaster.findMany({
            where: { empIsDeleted: false, empIsActive: true },
            select: { empId: true, empName: true },
            orderBy: [{ empName: 'asc' }, { empId: 'asc' }],
          }),
        (row) => this.toOption(row.empId, row.empName),
      ),
      tenderTypes: this.simpleFetcher(
        () =>
          this.prisma.accountTenderTypes.findMany({
            where: {
              accttTypeIsDeleted: false,
              accttTypeIsActive: true,
            },
            select: { accttTypeId: true, accttTypeName: true },
            orderBy: [{ accttTypeName: 'asc' }, { accttTypeId: 'asc' }],
          }),
        (row) => this.toOption(String(row.accttTypeId), row.accttTypeName),
      ),
      tenders: this.simpleFetcher(
        () =>
          this.prisma.accountTenderMaster.findMany({
            where: {
              acctndIsDeleted: false,
              acctndIsActive: true,
            },
            select: { acctndId: true, acctndName: true },
            orderBy: [{ acctndName: 'asc' }, { acctndId: 'asc' }],
          }),
        (row) => this.toOption(row.acctndId, row.acctndName),
      ),
      gspProviders: this.simpleFetcher(
        () =>
          this.prisma.gspProviderMaster.findMany({
            where: { gspIsDeleted: false, gspIsActive: true },
            select: { gspProviderId: true, gspProviderName: true },
            orderBy: [{ gspProviderName: 'asc' }, { gspProviderId: 'asc' }],
          }),
        (row) => this.toOption(row.gspProviderId, row.gspProviderName),
      ),
      gspCompanyServices: async () => {
        const rows = await this.prisma.gspCompanyService.findMany({
          where: {
            csgIsDeleted: false,
            csgIsActive: true,
          },
          select: {
            csgCompanyServiceId: true,
            csgServiceType: true,
            company: { select: { compName: true } },
          },
          orderBy: [{ csgServiceType: 'asc' }, { csgCompanyServiceId: 'asc' }],
        });
        return rows.map((row) =>
          this.toOption(row.csgCompanyServiceId, `${row.csgServiceType} - ${row.company.compName}`),
        );
      },
      itemGroups: this.simpleFetcher(
        () =>
          this.prisma.itemGroupMaster.findMany({
            where: { itgIsDeleted: false, itgIsActive: true },
            select: { itgId: true, itgName: true },
            orderBy: [{ itgName: 'asc' }, { itgId: 'asc' }],
          }),
        (row) => this.toOption(row.itgId, row.itgName),
      ),
      itemCategories: this.simpleFetcher(
        () =>
          this.prisma.categoryMaster.findMany({
            where: { categoryIsDeleted: false, categoryIsActive: true },
            select: { categoryId: true, categoryName: true },
            orderBy: [{ categoryName: 'asc' }, { categoryId: 'asc' }],
          }),
        (row) => this.toOption(row.categoryId, row.categoryName),
      ),
      itemSections: this.simpleFetcher(
        () =>
          this.prisma.itemSectionMaster.findMany({
            where: { secIsDeleted: false, secIsActive: true },
            select: { secId: true, secName: true },
            orderBy: [{ secName: 'asc' }, { secId: 'asc' }],
          }),
        (row) => this.toOption(row.secId, row.secName),
      ),
      itemBrands: this.simpleFetcher(
        () =>
          this.prisma.itemBrandMaster.findMany({
            where: { brand_is_deleted: false, brand_is_active: true },
            select: { brand_id: true, brand_name: true },
            orderBy: [{ brand_name: 'asc' }, { brand_id: 'asc' }],
          }),
        (row) => this.toOption(row.brand_id, row.brand_name),
      ),
      units: this.simpleFetcher(
        () =>
          this.prisma.unit.findMany({
            where: { unit_is_deleted: false, unit_is_active: true },
            select: { unit_id: true, unit_name: true },
            orderBy: [{ unit_name: 'asc' }, { unit_id: 'asc' }],
          }),
        (row) => this.toOption(row.unit_id, row.unit_name),
      ),
      itemTaxes: this.simpleFetcher(
        () =>
          this.prisma.itemTaxMaster.findMany({
            where: { taxIsDeleted: false, taxIsActive: true },
            select: { taxId: true, taxName: true },
            orderBy: [{ taxName: 'asc' }, { taxId: 'asc' }],
          }),
        (row) => this.toOption(row.taxId, row.taxName),
      ),
      priceLevels: async () => {
        const rows = await this.prisma.priceLevel.findMany({
          where: {
            priceLvlIsDeleted: false,
            priceLvlIsActive: true,
          },
          select: { priceLvlId: true, priceLvlName: true, priceLvlShort: true },
          orderBy: [{ priceLvlName: 'asc' }, { priceLvlId: 'asc' }],
        });
        return rows.map((row) =>
          this.toOption(String(row.priceLvlId), row.priceLvlName ?? row.priceLvlShort),
        );
      },
      hsnCodes: async () => {
        const rows = await this.prisma.hsnMaster.findMany({
          where: {
            hsnIsActive: true,
          },
          select: { hsnCode: true, hsnId: true },
          orderBy: [{ hsnCode: 'asc' }, { hsnId: 'asc' }],
        });
        return rows.map((row) => this.toOption(row.hsnCode, row.hsnCode));
      },
      items: this.simpleFetcher(
        () =>
          this.prisma.itemMaster.findMany({
            where: {
              itemIsDeleted: false,
              itemIsActive: true,
            },
            select: { itemId: true, itemNameEn: true },
            orderBy: [{ itemNameEn: 'asc' }, { itemId: 'asc' }],
          }),
        (row) => this.toOption(row.itemId, row.itemNameEn),
      ),
      godownLocations: this.simpleFetcher(
        () =>
          this.prisma.godownLocation.findMany({
            where: { gdlIsDeleted: false, gdlIsActive: true },
            select: { gdlId: true, gdlName: true },
            orderBy: [{ gdlName: 'asc' }, { gdlId: 'asc' }],
          }),
        (row) => this.toOption(row.gdlId, row.gdlName),
      ),
      stateCodes: async () => {
        const rows = await this.prisma.stateCode.findMany({
          where: {
            isDeleted: false,
            isActive: true,
          },
          select: { stateCode: true, stateName: true },
          orderBy: [{ stateName: 'asc' }, { stateCode: 'asc' }],
        });
        return rows.map((row) => this.toOption(row.stateCode, row.stateName));
      },
      states: this.simpleFetcher(
        () =>
          this.prisma.stateMaster.findMany({
            where: { stmIsDeleted: false, stmIsActive: true },
            select: { stmId: true, stmName: true },
            orderBy: [{ stmName: 'asc' }, { stmId: 'asc' }],
          }),
        (row) => this.toOption(row.stmId, row.stmName),
      ),
      cities: this.simpleFetcher(
        () =>
          this.prisma.cityMaster.findMany({
            where: { ctmIsDeleted: false, ctmIsActive: true },
            select: { ctmId: true, ctmName: true },
            orderBy: [{ ctmName: 'asc' }, { ctmId: 'asc' }],
          }),
        (row) => this.toOption(row.ctmId, row.ctmName),
      ),
      areas: this.simpleFetcher(
        () =>
          this.prisma.areaMaster.findMany({
            where: { armIsDeleted: false, armIsActive: true },
            select: { armId: true, armName: true },
            orderBy: [{ armName: 'asc' }, { armId: 'asc' }],
          }),
        (row) => this.toOption(row.armId, row.armName),
      ),
      customerGroups: this.simpleFetcher(
        () =>
          this.prisma.custGroup.findMany({
            where: {
              cgrIsDeleted: false,
              cgrIsActive: true,
            },
            select: { cgrId: true, cgrName: true, cgrAlias: true },
            orderBy: [{ cgrName: 'asc' }, { cgrId: 'asc' }],
          }),
        (row) => this.toOption(row.cgrId, row.cgrName ?? row.cgrAlias ?? row.cgrId),
      ),
      customers: this.simpleFetcher(
        () =>
          this.prisma.customer.findMany({
            where: {
              cusIsDeleted: false,
              cusIsActive: true,
            },
            select: { cusId: true, cusName: true },
            orderBy: [{ cusName: 'asc' }, { cusId: 'asc' }],
          }),
        (row) => this.toOption(row.cusId, row.cusName ?? row.cusId),
      ),
      supplierGroups: this.simpleFetcher(
        () =>
          this.prisma.supplierGroup.findMany({
            where: { spgIsDeleted: false, spgIsActive: true },
            select: { spgId: true, spgName: true },
            orderBy: [{ spgName: 'asc' }, { spgId: 'asc' }],
          }),
        (row) => this.toOption(row.spgId, row.spgName),
      ),
      suppliers: this.simpleFetcher(
        () =>
          this.prisma.supplier.findMany({
            where: { supIsDeleted: false, supIsActive: true },
            select: { supId: true, supName: true },
            orderBy: [{ supName: 'asc' }, { supId: 'asc' }],
          }),
        (row) => this.toOption(row.supId, row.supName),
      ),
      userMasters: this.simpleFetcher(
        () =>
          this.prisma.userMaster.findMany({
            where: {
              usrIsDeleted: false,
              usrIsActive: true,
            },
            select: { usrId: true, usrDisplayName: true },
            orderBy: [{ usrDisplayName: 'asc' }, { usrId: 'asc' }],
          }),
        (row) => this.toOption(row.usrId, row.usrDisplayName),
      ),
    };
  }
  /**
   * Factory for modules that map a Prisma table query to `{ id, name }` options.
   */
  private simpleFetcher<T>(
    queryFn: () => Promise<T[]>,
    mapper: (row: T) => NameIdOption,
  ): ModuleFetcher {
    return async () => {
      const rows = await queryFn();
      return rows.map(mapper);
    };
  }
  // ─── Core Fetch Logic ────────────────────────────────────────────────────────
  private async fetchModuleItems(
    module: LookupModuleKey,
    configuredDropdowns: Map<LookupModuleKey, DropdownLookupConfig>,
  ): Promise<NameIdOption[]> {
    const config = configuredDropdowns.get(module);
    if (config) {
      const configured = await this.tryFetchConfiguredModuleItems(config);
      if (configured !== null) return configured;
    }
    return this.moduleFetchers[module]();
  }
  // ─── Dropdown Config Loading ─────────────────────────────────────────────────
  private async loadLookupDropdownConfigs(): Promise<Map<LookupModuleKey, DropdownLookupConfig>> {
    const records = await this.prisma.dropdownDetails.findMany({
      include: {
        dropdownColumns: { orderBy: [{ dropdownColumnsNo: 'asc' }] },
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
          .filter((col) => col.dropdownColumnsVisiblity)
          .map((col) => ({
            name: col.dropdownColumnsName,
            alias: col.dropdownColumnsAlias,
            filter: col.dropdownColumnsFilter,
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
    const aliases = new Set<string>([
      module,
      ...MODULE_DROPDOWN_NAME_ALIASES[module],
      ...LOOKUP_MODULE_ALIASES[module],
    ]);
    const exactMatch = records.find((r) => aliases.has(r.dropdownName.trim()));
    if (exactMatch) return exactMatch;
    const normalizedAliases = Array.from(aliases).map((a) => this.normalizeLookupToken(a));
    return records.find((r) => normalizedAliases.includes(this.normalizeLookupToken(r.dropdownName)));
  }
  // ─── Configured SQL Fetching ─────────────────────────────────────────────────
  private async tryFetchConfiguredModuleItems(
    config: DropdownLookupConfig,
  ): Promise<NameIdOption[] | null> {
    const sqlCandidates = this.resolveConfiguredSqlCandidates(config);
    if (sqlCandidates.length === 0) return null;
    for (const sql of sqlCandidates) {
      try {
        // Stored dropdown SQL is user-configured — run it on the read-only pool.
        const result = await this.pg.queryReadOnly<LookupRow>(sql);
        return this.mapConfiguredRowsToOptions(result.rows, config.dropdownColumns, config);
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
    config: DropdownLookupConfig,
  ): NameIdOption[] {
    return rows
      .map((row) => ({ row, option: this.mapConfiguredRowToOption(row, columns) }))
      .filter((item): item is { row: LookupRow; option: NameIdOption } => item.option !== null)
      .sort((a, b) => this.compareConfiguredRows(a, b, config))
      .map((item) => item.option);
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
    const option = this.toOption(idValue, nameValue, { fallbackNameToId: false });
    return {
      ...this.serializeLookupRow(row),
      ...option,
    };
  }
  private serializeLookupRow(row: LookupRow): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, this.serializeLookupValue(value)]),
    );
  }
  private serializeLookupValue(value: unknown): unknown {
    if (typeof value === 'bigint') return value.toString();
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((item) => this.serializeLookupValue(item));
    if (value && typeof value === 'object') {
      const prototype = Object.getPrototypeOf(value);
      if (prototype === Object.prototype || prototype === null) {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
            key,
            this.serializeLookupValue(nested),
          ]),
        );
      }
    }
    return value;
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
  private toDateOnly(value: Date | null | undefined): string | null {
    return value ? value.toISOString().slice(0, 10) : null;
  }
  /**
   * Legacy billed_date: `concat((CURRENT_DATE - billed_date),' days : ',
   * to_char(billed_date, 'dd/MM/yy'))` → e.g. "10 days : 01/07/26". Uses UTC
   * getters since `@db.Date` values are returned at UTC midnight.
   */
  private formatBilledDate(billedDate: Date | null): string | null {
    if (!billedDate) return null;
    const now = new Date();
    const billedUtc = Date.UTC(
      billedDate.getUTCFullYear(),
      billedDate.getUTCMonth(),
      billedDate.getUTCDate(),
    );
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const days = Math.floor((todayUtc - billedUtc) / 86_400_000);
    const dd = String(billedDate.getUTCDate()).padStart(2, '0');
    const mm = String(billedDate.getUTCMonth() + 1).padStart(2, '0');
    const yy = String(billedDate.getUTCFullYear()).slice(-2);
    return `${days} days : ${dd}/${mm}/${yy}`;
  }
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
  private toFreightChargeOption(row: {
    frId: string;
    frFromKm: number | null;
    frToKm: number | null;
    frFreightChrg: unknown;
    frFromWeight: unknown;
    frToWeight: unknown;
    frLoadChrg: unknown;
    frUnloadChrg: unknown;
  }): FreightChargeOption {
    return {
      id: row.frId,
      fromKm: row.frFromKm ?? null,
      toKm: row.frToKm ?? null,
      freightCharge: this.toNullableNumber(row.frFreightChrg),
      fromWeight: this.toNullableNumber(row.frFromWeight),
      toWeight: this.toNullableNumber(row.frToWeight),
      loadCharge: this.toNullableNumber(row.frLoadChrg),
      unloadCharge: this.toNullableNumber(row.frUnloadChrg),
    };
  }
  private toNullableNumber(value: unknown): number | null {
    return value === null || value === undefined ? null : toNumber(value as never);
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
}