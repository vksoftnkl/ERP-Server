"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerDetailLookup = void 0;
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const lookup_option_utils_1 = require("../utils/lookup-option.utils");
class CustomerDetailLookup {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getCustomerDetail(query) {
        const { cus_id, company_id } = query;
        const regional = query.regional ?? false;
        const customer = await this.prisma.customer.findFirst({
            where: { cusId: cus_id, cusIsDeleted: false },
            include: { area: { select: { armName: true, armDistanceKm: true } } },
        });
        if (!customer) {
            (0, module_service_utils_1.throwMasterNotFound)('Customer not found', 'cus_id', `No active customer found for id ${cus_id}`);
        }
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
            debit_days: customer.cusCreditDays,
            debit_limit: (0, module_service_utils_1.toNumber)(customer.cusCreditAmtLimit),
            debit_allowed: customer.cusCreditAllowed,
            freight_charge: customer.cusFreightCharge,
            cooly: customer.cusLoadingCharge,
            unloading_charge: customer.cusUnloadingCharge,
            allow_promotion: customer.cusAllowPromotion,
            allow_loyalty: customer.cusAllowLoyalty,
            allow_discount: customer.cusAllowDiscount,
            overdue_billing: customer.cusOverdueBilling,
            price_level: customer.cusPriceLevelId,
            cust_disc_perc: (0, module_service_utils_1.toNumber)(customer.cusDiscPerc),
            salesman_id: customer.cusDefaultSalesman,
            salesman_name: salesman?.empName ?? null,
            tcs_company: company?.compTcsApplicable ?? false,
            tcs_customer: customer.cusItcollType === 'TCS' && customer.cusItcollExempted === false,
            cust_pan: Boolean(customer.cusPanNo),
            local_sales: !!company && customer.cusStateCode === company.compStateCode,
            cust_points: null,
            billed_date: (0, lookup_option_utils_1.formatBilledDate)(customer.cusBilledDate),
        };
    }
}
exports.CustomerDetailLookup = CustomerDetailLookup;
//# sourceMappingURL=customer-detail.lookup.js.map