import {
  MasterErrorDetail,
  throwMasterNotFound,
  toNumber,
} from '../../../common/utils/module-service.utils';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { CustomerDetailQueryDto } from '../dto/customer-detail-query.dto';
import { CustomerDetail } from '../types/master-lookup-api.types';
import { formatBilledDate } from '../utils/lookup-option.utils';
import { MasterLookupErrorCode } from '../types/master-lookup-error-codes';
import { lastBilledOf } from '../../../common/party/party-billed';
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
 *  - `tcs_customer`: false when the customer is exempted (cus_itcoll_exempted);
 *    otherwise the linked ledger's led_is_tcs_applicable (cus_id IS led_id), which
 *    the customer save derives from cusTcsApplicable / a 'TCS' IT-collection type
 *    and which receipts read. A legacy customer with no ledger falls back to
 *    cusTcsApplicable / a 'TCS' type on its own columns.
 *  - `local_sales`: true when the customer and company share a state code. An
 *    unknown or deleted company_id is refused (LOOKUP_COMPANY_NOT_FOUND) rather
 *    than answered as an inter-state sale.
 *  - `billed_date`: "<n> days : dd/MM/yy" of the customer's last POSTED sale bill
 *    (party rules D3, read from the bills; cus_billed_date is no longer used).
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
        MasterLookupErrorCode.CUSTOMER_NOT_FOUND,
      );
    }
    // Company (legacy INNER JOIN companys ON comp_id = icompany_id) and the
    // salesman (legacy default_salesman[1] ⋈ employee_master).
    const [company, ledger, salesman, billed] = await Promise.all([
      this.prisma.company.findFirst({
        where: { compId: company_id, compIsDeleted: false },
        select: { compTcsApplicable: true, compStateCode: true },
      }),
      this.prisma.accLedgerMaster.findFirst({
        where: { ledId: customer.cusId, ledIsDeleted: false },
        select: { ledIsTcsApplicable: true },
      }),
      customer.cusDefaultSalesman
        ? this.prisma.employeeMaster.findFirst({
            where: { empId: customer.cusDefaultSalesman, empIsDeleted: false },
            select: { empName: true },
          })
        : Promise.resolve(null),
      // Party rules D3 (Q9 = B): the last POSTED sale bill, read now.
      lastBilledOf(this.prisma, customer.cusId),
    ]);
    if (!company) {
      throwMasterNotFound<MasterErrorDetail>(
        'Company not found',
        'company_id',
        `No active company found for id ${company_id}`,
        MasterLookupErrorCode.COMPANY_NOT_FOUND,
      );
    }
    // The save's rule: an exemption vetoes TCS, whatever else says it applies.
    const tcsCustomer =
      !customer.cusItcollExempted &&
      (ledger
        ? ledger.ledIsTcsApplicable
        : customer.cusTcsApplicable || customer.cusItcollType?.trim().toUpperCase() === 'TCS');
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
      tcs_company: company.compTcsApplicable,
      tcs_customer: tcsCustomer,
      cust_pan: Boolean(customer.cusPanNo),
      // Legacy `local_sales`: customer and company in the same state.
      local_sales: customer.cusStateCode === company.compStateCode,
      cust_points: null,
      billed_date: formatBilledDate(billed.date),
    };
  }
}
