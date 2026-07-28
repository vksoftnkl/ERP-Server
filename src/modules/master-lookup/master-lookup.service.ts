import { Injectable } from '@nestjs/common';
import { MasterErrorDetail, throwMasterNotFound } from '../../common/utils/module-service.utils';
import { PgService } from '../../database/pg/pg.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CustomerDetailQueryDto } from './dto/customer-detail-query.dto';
import { ItemPriceLookupQueryDto } from './dto/item-price-lookup-query.dto';
import { ItemPriceRefreshQueryDto } from './dto/item-price-refresh-query.dto';
import { ConfiguredDropdownLookup } from './lookups/configured-dropdown.lookup';
import { CustomerDetailLookup } from './lookups/customer-detail.lookup';
import { ItemPriceLookup } from './lookups/item-price.lookup';
import { buildModuleFetchers } from './lookups/module-fetchers';
import {
  ACCOUNT_LOOKUP_MODULE_KEYS,
  AccountsLookupModuleKey,
  BarcodeItemLookup,
  CustomerDetail,
  FiscalYearOption,
  FreightChargeOption,
  ItemPriceLookupPayload,
  ItemUnitCyclePayload,
  ItemUnitOption,
  LookupModuleKey,
  LOOKUP_MODULE_KEYS,
  MASTER_LOOKUP_MODULE_KEYS,
  MasterLookupDataPayload,
  NameIdOption,
  SingleModuleLookupPayload,
} from './types/master-lookup-api.types';
import { DropdownLookupConfig, ModuleFetcher } from './types/master-lookup-internal.types';
import { toDateOnly, toFreightChargeOption, toOption } from './utils/lookup-option.utils';

/**
 * Read-only lookups behind the master-lookup endpoints. Option lists come from
 * the dropdowns configured in `dropdown_details` where one exists, and from the
 * module's own Prisma query otherwise; the remaining endpoints are ports of the
 * legacy PL/pgSQL lookup cursors.
 */
@Injectable()
export class MasterLookupService {
  private readonly moduleFetchers: Record<LookupModuleKey, ModuleFetcher>;
  private readonly configuredDropdowns: ConfiguredDropdownLookup;
  private readonly customerDetail: CustomerDetailLookup;
  private readonly itemPrice: ItemPriceLookup;

  constructor(
    private readonly prisma: PrismaService,
    pg: PgService,
  ) {
    this.moduleFetchers = buildModuleFetchers(prisma);
    this.configuredDropdowns = new ConfiguredDropdownLookup(prisma, pg);
    this.customerDetail = new CustomerDetailLookup(prisma);
    this.itemPrice = new ItemPriceLookup(prisma);
  }

  // ─── Module option lookups ──────────────────────────────────────────────────

  /** Every accounts/masters module's options, or just one when `module` is given. */
  async getAllAccountsAndMasterNameIds(module?: LookupModuleKey): Promise<MasterLookupDataPayload> {
    const configuredDropdowns = await this.configuredDropdowns.loadConfigsByModule();
    if (module) {
      const items = await this.fetchModuleItems(module, configuredDropdowns);
      return this.toSingleModulePayload(module, items);
    }
    const byModule = await this.fetchModules(LOOKUP_MODULE_KEYS, configuredDropdowns);
    return {
      accounts: pickModules(byModule, ACCOUNT_LOOKUP_MODULE_KEYS),
      masters: pickModules(byModule, MASTER_LOOKUP_MODULE_KEYS),
    };
  }

  /** The master modules' options flattened into one `{ id, name }` list. */
  async getAllMasters(module?: LookupModuleKey): Promise<NameIdOption[]> {
    const configuredDropdowns = await this.configuredDropdowns.loadConfigsByModule();
    const moduleKeys: readonly LookupModuleKey[] = module ? [module] : MASTER_LOOKUP_MODULE_KEYS;
    const byModule = await this.fetchModules(moduleKeys, configuredDropdowns);
    return Object.values(byModule)
      .flat()
      .map((item) => ({ id: item.id, name: item.name }));
  }

  /** Options of one configured dropdown by id, empty when it is missing or unusable. */
  async getDropdownSqlData(dropdownId: number): Promise<NameIdOption[]> {
    const config = await this.configuredDropdowns.loadConfigById(dropdownId);
    if (!config) return [];
    return (await this.configuredDropdowns.fetchItems(config)) ?? [];
  }

  // ─── Scoped lookups ─────────────────────────────────────────────────────────

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
    return rows.map((row) => toOption(row.brId, row.brName));
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
      beginDate: toDateOnly(row.fyBeginDate),
      endDate: toDateOnly(row.fyEndDate),
      status: row.fyStatus,
      isCurrent: row.fyIsCurrent,
    }));
  }

  /**
   * Legacy `iflag = 9`: the active freight-charge slabs whose km range covers the
   * given distance (distance BETWEEN fr_from_km AND fr_to_km).
   */
  async getFreightChargesForDistance(distance: number): Promise<FreightChargeOption[]> {
    const rows = await this.prisma.saleFreightCharge.findMany({
      where: {
        frIsDeleted: false,
        frIsActive: true,
        frFromKm: { lte: distance },
        frToKm: { gte: distance },
      },
      orderBy: [{ frFromKm: 'asc' }, { frFromWeight: 'asc' }],
    });
    return rows.map((row) => toFreightChargeOption(row));
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
   * Resolve an item into its selling/purchase units from `item_unit_conversion`
   * joined to `item_unit_master`. Returns active, non-deleted conversion rows in
   * unit-slno order (base unit first). `itemUnitId` is the conversion PK (iuc_id)
   * that sale/quotation lines reference, `unitId`/`unitName` come from the unit.
   */
  async getUnitsByItem(itemId: string): Promise<ItemUnitOption[]> {
    const rows = await this.prisma.itemUnitConversion.findMany({
      where: { iucItemId: itemId, iucIsActive: true, iucIsDeleted: false },
      orderBy: [{ iucUnitSlno: 'asc' }],
      select: {
        iucId: true,
        iucUnitId: true,
        unit: { select: { unit_name: true } },
      },
    });
    return rows.map((row) => ({
      itemUnitId: row.iucId,
      unitId: row.iucUnitId,
      unitName: row.unit.unit_name,
    }));
  }

  /** Legacy `iflag = 7`: one customer's sales profile within a company. */
  async getCustomerDetail(query: CustomerDetailQueryDto): Promise<CustomerDetail> {
    return this.customerDetail.getCustomerDetail(query);
  }

  /** Legacy `getItemForSale`: one item + unit rate resolved for a sale line. */
  async getItemPriceLookup(query: ItemPriceLookupQueryDto): Promise<ItemPriceLookupPayload> {
    return this.itemPrice.getItemPriceLookup(query);
  }

  /**
   * The conversion after the one the caller has selected — the "cycle unit"
   * action of the entry screens. Returns the next iuc_id only, no price row.
   */
  async refreshItemPriceLookup(query: ItemPriceRefreshQueryDto): Promise<ItemUnitCyclePayload> {
    return this.itemPrice.refreshItemPriceLookup(query);
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private async fetchModules<TKey extends LookupModuleKey>(
    moduleKeys: readonly TKey[],
    configuredDropdowns: Map<LookupModuleKey, DropdownLookupConfig>,
  ): Promise<Record<TKey, NameIdOption[]>> {
    const entries = await Promise.all(
      moduleKeys.map(
        async (key) => [key, await this.fetchModuleItems(key, configuredDropdowns)] as const,
      ),
    );
    return Object.fromEntries(entries) as Record<TKey, NameIdOption[]>;
  }

  /** The configured dropdown of a module, falling back to its Prisma query. */
  private async fetchModuleItems(
    module: LookupModuleKey,
    configuredDropdowns: Map<LookupModuleKey, DropdownLookupConfig>,
  ): Promise<NameIdOption[]> {
    const config = configuredDropdowns.get(module);
    if (config) {
      const configured = await this.configuredDropdowns.fetchItems(config);
      if (configured !== null) return configured;
    }
    return this.moduleFetchers[module]();
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

/** Narrows the fetched module map to one scope's keys, in payload order. */
function pickModules<TKey extends LookupModuleKey>(
  byModule: Record<LookupModuleKey, NameIdOption[]>,
  moduleKeys: readonly TKey[],
): Record<TKey, NameIdOption[]> {
  return Object.fromEntries(moduleKeys.map((key) => [key, byModule[key]])) as Record<
    TKey,
    NameIdOption[]
  >;
}
