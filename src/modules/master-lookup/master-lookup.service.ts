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

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_LOOKUP_LIMIT = 20;

@Injectable()
export class MasterLookupService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllAccountsAndMasterNameIds(
    module?: LookupModuleKey,
    search?: string,
    limit?: number,
  ): Promise<MasterLookupDataPayload> {
    const normalizedSearch = this.normalizeSearch(search);
    const take = this.resolveTake(normalizedSearch, limit);

    if (module) {
      const items = await this.fetchModuleItems(module, normalizedSearch, take);
      return this.toSingleModulePayload(module, items);
    }

    const modules = await Promise.all(
      LOOKUP_MODULE_KEYS.map(async (moduleKey) => [
        moduleKey,
        await this.fetchModuleItems(moduleKey, normalizedSearch, take),
      ]),
    );

    const byModule = Object.fromEntries(modules) as Record<LookupModuleKey, NameIdOption[]>;

    return {
      accounts: {
        companies: byModule.companies,
        companyGroups: byModule.companyGroups,
        branches: byModule.branches,
        accountGroups: byModule.accountGroups,
        accountLedgers: byModule.accountLedgers,
        ledgerBankAccounts: byModule.ledgerBankAccounts,
        ledgerShippingAddresses: byModule.ledgerShippingAddresses,
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
        items: byModule.items,
        godownLocations: byModule.godownLocations,
        states: byModule.states,
        cities: byModule.cities,
        areas: byModule.areas,
        customerGroups: byModule.customerGroups,
        customers: byModule.customers,
        supplierGroups: byModule.supplierGroups,
        suppliers: byModule.suppliers,
      },
    };
  }

  private toOption(id: string, name: string | null | undefined): NameIdOption {
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    return {
      id,
      name: normalizedName || id,
    };
  }

  private toSingleModulePayload(
    module: LookupModuleKey,
    items: NameIdOption[],
  ): SingleModuleLookupPayload {
    if (ACCOUNT_LOOKUP_MODULE_KEYS.includes(module as AccountsLookupModuleKey)) {
      return {
        scope: 'accounts',
        module,
        items,
      };
    }

    return {
      scope: 'masters',
      module,
      items,
    };
  }

  private async fetchModuleItems(
    module: LookupModuleKey,
    search?: string,
    take?: number,
  ): Promise<NameIdOption[]> {
    const contains = search ? this.buildContainsFilter(search) : undefined;

    switch (module) {
      case 'companies': {
        const rows = await this.prisma.company.findMany({
          where: {
            compIsDeleted: false,
            compIsActive: true,
            ...(contains ? { compName: contains } : {}),
          },
          select: { compId: true, compName: true },
          orderBy: [{ compName: 'asc' }, { compId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.compId, row.compName));
      }

      case 'companyGroups': {
        const rows = await this.prisma.companyGroupMaster.findMany({
          where: {
            cogIsDeleted: false,
            cogIsActive: true,
            ...(contains ? { cogGroupName: contains } : {}),
          },
          select: { cogGroupId: true, cogGroupName: true },
          orderBy: [{ cogGroupName: 'asc' }, { cogGroupId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.cogGroupId, row.cogGroupName));
      }

      case 'branches': {
        const rows = await this.prisma.branchMaster.findMany({
          where: {
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

      case 'accountGroups': {
        const rows = await this.prisma.accountGroup.findMany({
          where: {
            accGroupIsDeleted: false,
            accGroupIsActive: true,
            ...(contains ? { accGroupName: contains } : {}),
          },
          select: { accGroupId: true, accGroupName: true },
          orderBy: [{ accGroupName: 'asc' }, { accGroupId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.accGroupId, row.accGroupName));
      }

      case 'accountLedgers': {
        const rows = await this.prisma.accLedgerMaster.findMany({
          where: {
            ledIsDeleted: false,
            ledIsActive: true,
            ...(contains
              ? {
                  OR: [
                    { ledName: contains },
                    { ledAlias: contains },
                    { ledShort: contains },
                  ],
                }
              : {}),
          },
          select: { ledId: true, ledName: true },
          orderBy: [{ ledName: 'asc' }, { ledId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.ledId, row.ledName));
      }

      case 'ledgerBankAccounts': {
        const rows = await this.prisma.accLedgerBankAccount.findMany({
          where: {
            lbaIsDeleted: false,
            lbaIsActive: true,
            ...(contains
              ? {
                  OR: [
                    { lbaAccountHolder: contains },
                    { lbaAccountNo: contains },
                    {
                      ledger: {
                        is: {
                          ledName: contains,
                        },
                      },
                    },
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
          const label = `${row.lbaAccountHolder} (${row.lbaAccountNo})`;
          const ledgerLabel = row.ledger?.ledName ? ` - ${row.ledger.ledName}` : '';
          return this.toOption(row.lbaId, `${label}${ledgerLabel}`);
        });
      }

      case 'ledgerShippingAddresses': {
        const rows = await this.prisma.accShipAddr.findMany({
          where: {
            saaIsDeleted: false,
            saaIsActive: true,
            ...(contains
              ? {
                  OR: [
                    { saaTrdnm: contains },
                    { saaContactName: contains },
                    {
                      ledger: {
                        is: {
                          ledName: contains,
                        },
                      },
                    },
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
          this.toOption(
            row.saaId,
            row.saaTrdnm ?? row.saaContactName ?? row.ledger?.ledName ?? row.saaId,
          ),
        );
      }

      case 'employeeDesignations': {
        const rows = await this.prisma.employeeDesignation.findMany({
          where: {
            edIsDeleted: false,
            edIsActive: true,
            ...(contains ? { edName: contains } : {}),
          },
          select: { edId: true, edName: true },
          orderBy: [{ edName: 'asc' }, { edId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.edId, row.edName));
      }

      case 'employees': {
        const rows = await this.prisma.empMaster.findMany({
          where: {
            empIsDeleted: false,
            empIsActive: true,
            ...(contains ? { empName: contains } : {}),
          },
          select: { empId: true, empName: true },
          orderBy: [{ empName: 'asc' }, { empId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.empId, row.empName));
      }

      case 'tenderTypes': {
        const rows = await this.prisma.tenderTypeMaster.findMany({
          where: {
            ttmIsDeleted: false,
            ttmIsActive: true,
            ...(contains ? { ttmTypeName: contains } : {}),
          },
          select: { ttmTypeId: true, ttmTypeName: true },
          orderBy: [{ ttmTypeName: 'asc' }, { ttmTypeId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.ttmTypeId, row.ttmTypeName));
      }

      case 'tenders': {
        const rows = await this.prisma.tenderMaster.findMany({
          where: {
            tndIsDeleted: false,
            tndIsActive: true,
            ...(contains ? { tndName: contains } : {}),
          },
          select: { tndId: true, tndName: true },
          orderBy: [{ tndName: 'asc' }, { tndId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.tndId, row.tndName));
      }

      case 'gspProviders': {
        const rows = await this.prisma.gspProviderMaster.findMany({
          where: {
            gspIsDeleted: false,
            gspIsActive: true,
            ...(contains ? { gspProviderName: contains } : {}),
          },
          select: { gspProviderId: true, gspProviderName: true },
          orderBy: [{ gspProviderName: 'asc' }, { gspProviderId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.gspProviderId, row.gspProviderName));
      }

      case 'gspCompanyServices': {
        const rows = await this.prisma.gspCompanyService.findMany({
          where: {
            csgIsDeleted: false,
            csgIsActive: true,
            ...(contains
              ? {
                  OR: [
                    { csgServiceType: contains },
                    {
                      company: {
                        is: {
                          compName: contains,
                        },
                      },
                    },
                  ],
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
      }

      case 'itemGroups': {
        const rows = await this.prisma.itemGroupMaster.findMany({
          where: {
            itgIsDeleted: false,
            itgIsActive: true,
            ...(contains ? { itgName: contains } : {}),
          },
          select: { itgId: true, itgName: true },
          orderBy: [{ itgName: 'asc' }, { itgId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.itgId, row.itgName));
      }

      case 'itemCategories': {
        const rows = await this.prisma.categoryMaster.findMany({
          where: {
            categoryIsDeleted: false,
            categoryIsActive: true,
            ...(contains ? { categoryName: contains } : {}),
          },
          select: { categoryId: true, categoryName: true },
          orderBy: [{ categoryName: 'asc' }, { categoryId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.categoryId, row.categoryName));
      }

      case 'itemSections': {
        const rows = await this.prisma.itemSectionMaster.findMany({
          where: {
            secIsDeleted: false,
            secIsActive: true,
            ...(contains ? { secName: contains } : {}),
          },
          select: { secId: true, secName: true },
          orderBy: [{ secName: 'asc' }, { secId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.secId, row.secName));
      }

      case 'itemBrands': {
        const rows = await this.prisma.itemBrandMaster.findMany({
          where: {
            brand_is_deleted: false,
            brand_is_active: true,
            ...(contains ? { brand_name: contains } : {}),
          },
          select: { brand_id: true, brand_name: true },
          orderBy: [{ brand_name: 'asc' }, { brand_id: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.brand_id, row.brand_name));
      }

      case 'units': {
        const rows = await this.prisma.unit.findMany({
          where: {
            unit_is_deleted: false,
            unit_is_active: true,
            ...(contains ? { unit_name: contains } : {}),
          },
          select: { unit_id: true, unit_name: true },
          orderBy: [{ unit_name: 'asc' }, { unit_id: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.unit_id, row.unit_name));
      }

      case 'itemTaxes': {
        const rows = await this.prisma.itemTaxMaster.findMany({
          where: {
            taxIsDeleted: false,
            taxIsActive: true,
            ...(contains ? { taxName: contains } : {}),
          },
          select: { taxId: true, taxName: true },
          orderBy: [{ taxName: 'asc' }, { taxId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.taxId, row.taxName));
      }

      case 'items': {
        const rows = await this.prisma.itemMaster.findMany({
          where: {
            itemIsDeleted: false,
            itemIsActive: true,
            ...(contains
              ? {
                  OR: [{ itemNameEn: contains }, { itemCode: contains }, { itemAlias: contains }],
                }
              : {}),
          },
          select: { itemId: true, itemNameEn: true },
          orderBy: [{ itemNameEn: 'asc' }, { itemId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.itemId, row.itemNameEn));
      }

      case 'godownLocations': {
        const rows = await this.prisma.godownLocation.findMany({
          where: {
            gdlIsDeleted: false,
            gdlIsActive: true,
            ...(contains ? { gdlName: contains } : {}),
          },
          select: { gdlId: true, gdlName: true },
          orderBy: [{ gdlName: 'asc' }, { gdlId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.gdlId, row.gdlName));
      }

      case 'states': {
        const rows = await this.prisma.stateMaster.findMany({
          where: {
            stmIsDeleted: false,
            stmIsActive: true,
            ...(contains ? { stmName: contains } : {}),
          },
          select: { stmId: true, stmName: true },
          orderBy: [{ stmName: 'asc' }, { stmId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.stmId, row.stmName));
      }

      case 'cities': {
        const rows = await this.prisma.cityMaster.findMany({
          where: {
            ctmIsDeleted: false,
            ctmIsActive: true,
            ...(contains ? { ctmName: contains } : {}),
          },
          select: { ctmId: true, ctmName: true },
          orderBy: [{ ctmName: 'asc' }, { ctmId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.ctmId, row.ctmName));
      }

      case 'areas': {
        const rows = await this.prisma.areaMaster.findMany({
          where: {
            armIsDeleted: false,
            armIsActive: true,
            ...(contains ? { armName: contains } : {}),
          },
          select: { armId: true, armName: true },
          orderBy: [{ armName: 'asc' }, { armId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.armId, row.armName));
      }

      case 'customerGroups': {
        const rows = await this.prisma.custGroup.findMany({
          where: {
            cgrIsDeleted: false,
            cgrIsActive: true,
            ...(contains ? { cgrName: contains } : {}),
          },
          select: { cgrId: true, cgrName: true },
          orderBy: [{ cgrName: 'asc' }, { cgrId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.cgrId, row.cgrName));
      }

      case 'customers': {
        const rows = await this.prisma.customer.findMany({
          where: {
            cusIsDeleted: false,
            cusIsActive: true,
            ...(contains
              ? {
                  OR: [{ cusName: contains }, { cusCode: contains }, { cusShort: contains }],
                }
              : {}),
          },
          select: { cusId: true, cusName: true },
          orderBy: [{ cusName: 'asc' }, { cusId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.cusId, row.cusName ?? row.cusId));
      }

      case 'supplierGroups': {
        const rows = await this.prisma.supplierGroup.findMany({
          where: {
            spgIsDeleted: false,
            spgIsActive: true,
            ...(contains ? { spgName: contains } : {}),
          },
          select: { spgId: true, spgName: true },
          orderBy: [{ spgName: 'asc' }, { spgId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.spgId, row.spgName));
      }

      case 'suppliers': {
        const rows = await this.prisma.supplier.findMany({
          where: {
            supIsDeleted: false,
            supIsActive: true,
            ...(contains ? { supName: contains } : {}),
          },
          select: { supId: true, supName: true },
          orderBy: [{ supName: 'asc' }, { supId: 'asc' }],
          ...(take ? { take } : {}),
        });
        return rows.map((row) => this.toOption(row.supId, row.supName));
      }
    }
  }

  private normalizeSearch(search?: string): string | undefined {
    if (!search) {
      return undefined;
    }

    const trimmed = search.trim();
    return trimmed || undefined;
  }

  private resolveTake(search: string | undefined, limit?: number): number | undefined {
    if (limit !== undefined) {
      const normalized = Math.trunc(limit);
      if (normalized <= 0) {
        return 1;
      }

      return Math.min(normalized, MAX_LOOKUP_LIMIT);
    }

    if (search) {
      return DEFAULT_SEARCH_LIMIT;
    }

    return undefined;
  }

  private buildContainsFilter(search: string): { contains: string; mode: 'insensitive' } {
    return {
      contains: search,
      mode: 'insensitive',
    };
  }
}
