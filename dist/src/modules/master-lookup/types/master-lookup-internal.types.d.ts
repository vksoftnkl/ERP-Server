import { Prisma } from '@prisma/client';
import { NameIdOption } from './master-lookup-api.types';
export type PriceRowWithUnit = Prisma.ItemPriceMasterGetPayload<{
    include: {
        itemUnitConversion: {
            include: {
                unit: true;
            };
        };
    };
}>;
export type UnitCycleRow = {
    iucId: string;
    iucUnitId: string;
};
export type LoadingSlabRow = {
    ilcId: string;
    ilcCompId: string | null;
    ilcBranchId: string | null;
    ilcLoadChrg: Prisma.Decimal | null;
};
export type ModuleFetcher = () => Promise<NameIdOption[]>;
export type LookupRow = Record<string, unknown>;
export type DropdownLookupColumnConfig = {
    name: string;
    alias: string | null;
    filter: boolean;
    visible: boolean;
};
export type DropdownLookupConfig = {
    dropdownId: number;
    dropdownName: string;
    dropdownSql: string;
    dropdownSqlRegional: string | null;
    dropdownSortColumn: string | null;
    dropdownSortOrder: string | null;
    dropdownColumns: DropdownLookupColumnConfig[];
};
export type DropdownRecord = {
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
