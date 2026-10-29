import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { MasterLookupErrorCode } from '../types/master-lookup-error-codes';
import { CustomerDetailLookup } from './customer-detail.lookup';

const CUS_ID = '019c6f6c-be87-7a11-8905-36092c46b101';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b102';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46b103';

const customerRow = (overrides: Record<string, unknown> = {}) => ({
  cusId: CUS_ID,
  cusName: 'Ravi Stores',
  cusRegionName: null,
  cusAddr1: null,
  cusAddr2: null,
  cusAddr3: null,
  cusRegionAddr1: null,
  cusRegionAddr2: null,
  cusPin: null,
  cusEcommerceGstin: null,
  cusGstNo: null,
  cusGstType: null,
  cusStateCode: '33',
  cusStateName: 'Tamil Nadu',
  cusAreaId: null,
  area: null,
  cusPhone1: null,
  cusCreditDays: 0,
  cusCreditAmtLimit: new Prisma.Decimal(0),
  cusCreditAllowed: false,
  cusFreightCharge: false,
  cusLoadingCharge: false,
  cusUnloadingCharge: false,
  cusAllowPromotion: false,
  cusAllowLoyalty: false,
  cusAllowDiscount: true,
  cusOverdueBilling: false,
  cusPriceLevelId: 1,
  cusDiscPerc: new Prisma.Decimal(0),
  cusDefaultSalesman: null,
  cusPanNo: null,
  cusBilledDate: null,
  cusTcsApplicable: false,
  cusItcollExempted: false,
  cusItcollType: null,
  ...overrides,
});

describe('CustomerDetailLookup (F12 / R2)', () => {
  let prisma: {
    customer: { findFirst: jest.Mock };
    company: { findFirst: jest.Mock };
    accLedgerMaster: { findFirst: jest.Mock };
    employeeMaster: { findFirst: jest.Mock };
  };
  let lookup: CustomerDetailLookup;
  const query = { cus_id: CUS_ID, company_id: COMPANY_ID, branch_id: BRANCH_ID };

  beforeEach(() => {
    prisma = {
      customer: { findFirst: jest.fn().mockResolvedValue(customerRow()) },
      company: {
        findFirst: jest.fn().mockResolvedValue({ compTcsApplicable: true, compStateCode: '33' }),
      },
      accLedgerMaster: { findFirst: jest.fn().mockResolvedValue({ ledIsTcsApplicable: false }) },
      employeeMaster: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    lookup = new CustomerDetailLookup(prisma as unknown as PrismaService);
  });

  it('refuses a company that is unknown or deleted with a 404', async () => {
    prisma.company.findFirst.mockResolvedValue(null);

    const error = await lookup.getCustomerDetail(query).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(404);
    expect((error as HttpException).getResponse()).toMatchObject({
      errors: [{ field: 'company_id', code: MasterLookupErrorCode.COMPANY_NOT_FOUND }],
    });
    expect(prisma.company.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { compId: COMPANY_ID, compIsDeleted: false } }),
    );
  });

  it('answers local_sales and tcs_company from a live company', async () => {
    const detail = await lookup.getCustomerDetail(query);

    expect(detail).toMatchObject({ local_sales: true, tcs_company: true });
  });

  it.each([
    ['the ledger flag on, not exempted', { ledIsTcsApplicable: true }, {}, true],
    [
      'the ledger flag on, but exempted',
      { ledIsTcsApplicable: true },
      { cusItcollExempted: true },
      false,
    ],
    [
      'the ledger flag off, even with cusTcsApplicable',
      { ledIsTcsApplicable: false },
      { cusTcsApplicable: true },
      false,
    ],
  ])('tcs_customer with %s', async (_label, ledger, customer, expected) => {
    prisma.accLedgerMaster.findFirst.mockResolvedValue(ledger);
    prisma.customer.findFirst.mockResolvedValue(customerRow(customer));

    expect((await lookup.getCustomerDetail(query)).tcs_customer).toBe(expected);
    expect(prisma.accLedgerMaster.findFirst).toHaveBeenCalledWith({
      where: { ledId: CUS_ID, ledIsDeleted: false },
      select: { ledIsTcsApplicable: true },
    });
  });

  it.each([
    ['cusTcsApplicable', { cusTcsApplicable: true }, true],
    ['a TCS IT-collection type', { cusItcollType: ' tcs ' }, true],
    [
      'an exemption over cusTcsApplicable',
      { cusTcsApplicable: true, cusItcollExempted: true },
      false,
    ],
    ['neither', {}, false],
  ])('tcs_customer with no ledger falls back to %s', async (_label, customer, expected) => {
    prisma.accLedgerMaster.findFirst.mockResolvedValue(null);
    prisma.customer.findFirst.mockResolvedValue(customerRow(customer));

    expect((await lookup.getCustomerDetail(query)).tcs_customer).toBe(expected);
  });
});
