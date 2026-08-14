"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildModuleFetchers = buildModuleFetchers;
const lookup_option_utils_1 = require("../utils/lookup-option.utils");
function buildModuleFetchers(prisma) {
    return {
        companies: simpleFetcher(() => prisma.company.findMany({
            where: { compIsDeleted: false, compIsActive: true },
            select: { compId: true, compName: true },
            orderBy: [{ compName: 'asc' }, { compId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.compId, row.compName)),
        companyGroups: simpleFetcher(() => prisma.companyGroupMaster.findMany({
            where: { cogIsDeleted: false, cogIsActive: true },
            select: { cogGroupId: true, cogGroupName: true },
            orderBy: [{ cogGroupName: 'asc' }, { cogGroupId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.cogGroupId, row.cogGroupName)),
        branches: simpleFetcher(() => prisma.branchMaster.findMany({
            where: { brIsDeleted: false, brIsActive: true },
            select: { brId: true, brName: true },
            orderBy: [{ brName: 'asc' }, { brId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.brId, row.brName)),
        accountGroups: simpleFetcher(() => prisma.accountGroup.findMany({
            where: { accGroupIsDeleted: false, accGroupIsActive: true },
            select: { accGroupId: true, accGroupName: true },
            orderBy: [{ accGroupName: 'asc' }, { accGroupId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.accGroupId, row.accGroupName)),
        accountLedgers: simpleFetcher(() => prisma.accLedgerMaster.findMany({
            where: { ledIsDeleted: false, ledIsActive: true },
            select: { ledId: true, ledName: true },
            orderBy: [{ ledName: 'asc' }, { ledId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.ledId, row.ledName)),
        ledgerBankAccounts: async () => {
            const rows = await prisma.accLedgerBankAccount.findMany({
                where: { lbaIsDeleted: false, lbaIsActive: true },
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
                return (0, lookup_option_utils_1.toOption)(row.lbaId, `${row.lbaAccountHolder} (${row.lbaAccountNo})${ledgerSuffix}`);
            });
        },
        ledgerShippingAddresses: async () => {
            const rows = await prisma.accShipAddr.findMany({
                where: { saaIsDeleted: false, saaIsActive: true },
                select: {
                    saaId: true,
                    saaTradeName: true,
                    saaContactName: true,
                    ledger: { select: { ledName: true } },
                },
                orderBy: [{ saaSort: 'asc' }, { saaId: 'asc' }],
            });
            return rows.map((row) => (0, lookup_option_utils_1.toOption)(row.saaId, row.saaTradeName ?? row.saaContactName ?? row.ledger?.ledName ?? row.saaId));
        },
        employeeDepartments: simpleFetcher(() => prisma.employeeDepartment.findMany({
            where: { edptIsDeleted: false, edptIsActive: true },
            select: { edptId: true, edptName: true },
            orderBy: [{ edptName: 'asc' }, { edptId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.edptId, row.edptName)),
        employeeDesignations: simpleFetcher(() => prisma.employeeDesignation.findMany({
            where: { edIsDeleted: false, edIsActive: true },
            select: { edId: true, edName: true },
            orderBy: [{ edName: 'asc' }, { edId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.edId, row.edName)),
        employees: simpleFetcher(() => prisma.employeeMaster.findMany({
            where: { empIsDeleted: false, empIsActive: true },
            select: { empId: true, empName: true },
            orderBy: [{ empName: 'asc' }, { empId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.empId, row.empName)),
        tenderTypes: simpleFetcher(() => prisma.accTenderType.findMany({
            where: { ttmIsDeleted: false, ttmIsActive: true },
            select: { ttmTypeId: true, ttmTypeName: true },
            orderBy: [{ ttmTypeName: 'asc' }, { ttmTypeId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(String(row.ttmTypeId), row.ttmTypeName)),
        tenders: simpleFetcher(() => prisma.accTenderMaster.findMany({
            where: { tndIsDeleted: false, tndIsActive: true },
            select: { tndId: true, tndName: true },
            orderBy: [{ tndName: 'asc' }, { tndId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.tndId, row.tndName)),
        gspProviders: simpleFetcher(() => prisma.gspProviderMaster.findMany({
            where: { gspIsDeleted: false, gspIsActive: true },
            select: { gspProviderId: true, gspProviderName: true },
            orderBy: [{ gspProviderName: 'asc' }, { gspProviderId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.gspProviderId, row.gspProviderName)),
        gspCompanyServices: async () => {
            const rows = await prisma.gspCompanyService.findMany({
                where: { csgIsDeleted: false, csgIsActive: true },
                select: {
                    csgCompanyServiceId: true,
                    csgServiceType: true,
                    company: { select: { compName: true } },
                },
                orderBy: [{ csgServiceType: 'asc' }, { csgCompanyServiceId: 'asc' }],
            });
            return rows.map((row) => (0, lookup_option_utils_1.toOption)(row.csgCompanyServiceId, `${row.csgServiceType} - ${row.company.compName}`));
        },
        itemGroups: simpleFetcher(() => prisma.itemGroupMaster.findMany({
            where: { itgIsDeleted: false, itgIsActive: true },
            select: { itgId: true, itgName: true },
            orderBy: [{ itgName: 'asc' }, { itgId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.itgId, row.itgName)),
        itemCategories: simpleFetcher(() => prisma.categoryMaster.findMany({
            where: { categoryIsDeleted: false, categoryIsActive: true },
            select: { categoryId: true, categoryName: true },
            orderBy: [{ categoryName: 'asc' }, { categoryId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.categoryId, row.categoryName)),
        itemSections: simpleFetcher(() => prisma.itemSectionMaster.findMany({
            where: { secIsDeleted: false, secIsActive: true },
            select: { secId: true, secName: true },
            orderBy: [{ secName: 'asc' }, { secId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.secId, row.secName)),
        itemBrands: simpleFetcher(() => prisma.itemBrandMaster.findMany({
            where: { brand_is_deleted: false, brand_is_active: true },
            select: { brand_id: true, brand_name: true },
            orderBy: [{ brand_name: 'asc' }, { brand_id: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.brand_id, row.brand_name)),
        units: simpleFetcher(() => prisma.unit.findMany({
            where: { unit_is_deleted: false, unit_is_active: true },
            select: { unit_id: true, unit_name: true },
            orderBy: [{ unit_name: 'asc' }, { unit_id: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.unit_id, row.unit_name)),
        itemTaxes: simpleFetcher(() => prisma.itemTaxMaster.findMany({
            where: { taxIsDeleted: false, taxIsActive: true },
            select: { taxId: true, taxName: true },
            orderBy: [{ taxName: 'asc' }, { taxId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.taxId, row.taxName)),
        priceLevels: simpleFetcher(() => prisma.priceLevel.findMany({
            where: { priceLvlIsDeleted: false, priceLvlIsActive: true },
            select: { priceLvlId: true, priceLvlName: true, priceLvlShort: true },
            orderBy: [{ priceLvlId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(String(row.priceLvlId), row.priceLvlName ?? row.priceLvlShort)),
        hsnCodes: simpleFetcher(() => prisma.hsnMaster.findMany({
            where: { hsnIsActive: true },
            select: { hsnCode: true, hsnId: true },
            orderBy: [{ hsnCode: 'asc' }, { hsnId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.hsnCode, row.hsnCode)),
        items: simpleFetcher(() => prisma.itemMaster.findMany({
            where: { itemIsDeleted: false, itemIsActive: true },
            select: { itemId: true, itemNameEn: true },
            orderBy: [{ itemNameEn: 'asc' }, { itemId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.itemId, row.itemNameEn)),
        godownLocations: simpleFetcher(() => prisma.godownLocation.findMany({
            where: { gdlIsDeleted: false, gdlIsActive: true },
            select: { gdlId: true, gdlName: true },
            orderBy: [{ gdlName: 'asc' }, { gdlId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.gdlId, row.gdlName)),
        stateCodes: simpleFetcher(() => prisma.stateCode.findMany({
            where: { isDeleted: false, isActive: true },
            select: { stateCode: true, stateName: true },
            orderBy: [{ stateName: 'asc' }, { stateCode: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.stateCode, row.stateName)),
        states: simpleFetcher(() => prisma.stateMaster.findMany({
            where: { stmIsDeleted: false, stmIsActive: true },
            select: { stmId: true, stmName: true },
            orderBy: [{ stmName: 'asc' }, { stmId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.stmId, row.stmName)),
        cities: simpleFetcher(() => prisma.cityMaster.findMany({
            where: { ctmIsDeleted: false, ctmIsActive: true },
            select: { ctmId: true, ctmName: true },
            orderBy: [{ ctmName: 'asc' }, { ctmId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.ctmId, row.ctmName)),
        areas: simpleFetcher(() => prisma.areaMaster.findMany({
            where: { armIsDeleted: false, armIsActive: true },
            select: { armId: true, armName: true },
            orderBy: [{ armName: 'asc' }, { armId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.armId, row.armName)),
        customerGroups: simpleFetcher(() => prisma.custGroup.findMany({
            where: { cgrIsDeleted: false, cgrIsActive: true },
            select: { cgrId: true, cgrName: true, cgrAlias: true },
            orderBy: [{ cgrName: 'asc' }, { cgrId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.cgrId, row.cgrName ?? row.cgrAlias ?? row.cgrId)),
        customers: simpleFetcher(() => prisma.customer.findMany({
            where: { cusIsDeleted: false, cusIsActive: true },
            select: { cusId: true, cusName: true },
            orderBy: [{ cusName: 'asc' }, { cusId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.cusId, row.cusName ?? row.cusId)),
        supplierGroups: simpleFetcher(() => prisma.supplierGroup.findMany({
            where: { spgIsDeleted: false, spgIsActive: true },
            select: { spgId: true, spgName: true },
            orderBy: [{ spgName: 'asc' }, { spgId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.spgId, row.spgName)),
        suppliers: simpleFetcher(() => prisma.supplier.findMany({
            where: { supIsDeleted: false, supIsActive: true },
            select: { supId: true, supName: true },
            orderBy: [{ supName: 'asc' }, { supId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.supId, row.supName)),
        userMasters: simpleFetcher(() => prisma.userMaster.findMany({
            where: { usrIsDeleted: false, usrIsActive: true },
            select: { usrId: true, usrDisplayName: true },
            orderBy: [{ usrDisplayName: 'asc' }, { usrId: 'asc' }],
        }), (row) => (0, lookup_option_utils_1.toOption)(row.usrId, row.usrDisplayName)),
    };
}
function simpleFetcher(queryFn, mapper) {
    return async () => {
        const rows = await queryFn();
        return rows.map(mapper);
    };
}
//# sourceMappingURL=module-fetchers.js.map