"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODULE_DROPDOWN_NAME_ALIASES = exports.CONFIGURED_SQL_TABLE_REPLACEMENTS = exports.ID_ORDERED_LOOKUP_MODULES = exports.LOOKUP_NAME_NOISE_TOKENS = exports.DEFAULT_FREIGHT_TYPE = exports.FREIGHT_TYPES = exports.DEFAULT_LOADING_TYPE = exports.LOADING_TYPES = void 0;
exports.LOADING_TYPES = ['manual', 'item_basis', 'auto'];
exports.DEFAULT_LOADING_TYPE = 'manual';
exports.FREIGHT_TYPES = ['manual', 'item_basis'];
exports.DEFAULT_FREIGHT_TYPE = 'manual';
exports.LOOKUP_NAME_NOISE_TOKENS = new Set(['master', 'lookup', 'dropdown']);
exports.ID_ORDERED_LOOKUP_MODULES = new Set([
    'priceLevels',
]);
exports.CONFIGURED_SQL_TABLE_REPLACEMENTS = [
    [/\binventory\s*\.\s*units\b/gi, 'inventory.item_unit_master'],
    [/"inventory"\s*\.\s*"units"/gi, '"inventory"."item_unit_master"'],
    [/\baccounts\s*\.\s*companys\b/gi, 'public.companys'],
    [/"accounts"\s*\.\s*"companys"/gi, '"public"."companys"'],
    [/\baccounts\s*\.\s*branch_master\b/gi, 'public.branch_master'],
    [/"accounts"\s*\.\s*"branch_master"/gi, '"public"."branch_master"'],
];
exports.MODULE_DROPDOWN_NAME_ALIASES = {
    companies: ['companies', 'company'],
    companyGroups: ['company groups', 'company group'],
    branches: ['branches', 'branch'],
    accountGroups: ['account groups', 'account group', 'account ledger groups', 'ledger groups'],
    accountLedgers: ['account ledgers', 'account ledger', 'ledgers', 'ledger'],
    ledgerBankAccounts: [
        'ledger bank accounts',
        'ledger bank account',
        'bank accounts',
        'bank account',
    ],
    ledgerShippingAddresses: [
        'ledger shipping addresses',
        'ledger shipping address',
        'shipping addresses',
        'shipping address',
    ],
    employeeDepartments: ['employee departments', 'employee department', 'departments', 'department'],
    employeeDesignations: [
        'employee designations',
        'employee designation',
        'designations',
        'designation',
    ],
    employees: ['employees', 'employee'],
    tenderTypes: ['tender types', 'tender type'],
    tenders: ['tenders', 'tender'],
    gspProviders: ['gsp providers', 'gsp provider', 'providers', 'provider'],
    gspCompanyServices: [
        'gsp company services',
        'gsp company service',
        'company services',
        'company service',
    ],
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
    devices: ['devices', 'device', 'device list', 'device lists'],
};
//# sourceMappingURL=master-lookup.constants.js.map