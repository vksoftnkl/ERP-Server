import {
  MasterErrorDetail,
  throwMasterNotFound,
  toNumber,
} from '../../../common/utils/module-service.utils';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { CustomerDetailQueryDto } from '../dto/customer-detail-query.dto';
import { CustomerDetail } from '../types/master-lookup-api.types';
import { formatBilledDate } from '../utils/lookup-option.utils';

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
export class CustomerDetailLookup {
  constructor(private readonly prisma: PrismaService) {}

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
      billed_date: formatBilledDate(customer.cusBilledDate),
    };
  }
}
