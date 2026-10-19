import { HttpException } from '@nestjs/common';
import {
  throwSalesInvalid,
  throwSalesLocked,
  throwSalesRefusals,
  throwSalesRefused,
  throwSalesRight,
} from './sales.errors';
import { SALES_ERROR_CODES } from './types/posting.types';

/** The status and body of the HttpException a call threw. */
function thrownBy(call: () => unknown): { status: number; body: unknown } {
  try {
    call();
  } catch (error) {
    if (error instanceof HttpException) {
      return { status: error.getStatus(), body: error.getResponse() };
    }
    throw error;
  }
  throw new Error('expected the call to throw');
}

const STATUTORY = {
  code: 'CASH_LIMIT_269ST',
  value: 200000,
  effectiveFrom: '2017-04-01',
  isCompanyOverride: false,
};

describe('sales.errors — one throw site per status', () => {
  it('throwSalesLocked is a 409 carrying the code and any extra detail', () => {
    expect(
      thrownBy(() =>
        throwSalesLocked('Bill is posted', SALES_ERROR_CODES.BILL_POSTED, 'sbId', {
          status: 'POSTED',
        }),
      ),
    ).toEqual({
      status: 409,
      body: {
        success: false,
        message: 'Bill is posted',
        errors: [
          {
            field: 'sbId',
            message: 'Bill is posted',
            code: SALES_ERROR_CODES.BILL_POSTED,
            status: 'POSTED',
          },
        ],
      },
    });
  });

  it('throwSalesRefused is a 422 and may name the line and the statute', () => {
    expect(
      thrownBy(() =>
        throwSalesRefused('Cash over the limit', SALES_ERROR_CODES.CASH_LIMIT, 'tenders', {
          line: 2,
          statutory: STATUTORY,
        }),
      ),
    ).toMatchObject({
      status: 422,
      body: {
        errors: [
          { field: 'tenders', code: SALES_ERROR_CODES.CASH_LIMIT, line: 2, statutory: STATUTORY },
        ],
      },
    });
  });

  it('throwSalesRefusals sends every refusal at once and files a field-less one under document', () => {
    const { status, body } = thrownBy(() =>
      throwSalesRefusals('3 problems', [
        { code: SALES_ERROR_CODES.BACKDATE, message: 'Back-dated', field: 'billDate' },
        { code: SALES_ERROR_CODES.DISC_CAP, message: 'Discount too high', line: 4 },
        { code: SALES_ERROR_CODES.CASH_LIMIT, message: 'Cash limit', statutory: STATUTORY },
      ]),
    );

    expect(status).toBe(422);
    expect((body as { errors: unknown[] }).errors).toEqual([
      { field: 'billDate', message: 'Back-dated', code: SALES_ERROR_CODES.BACKDATE },
      { field: 'document', message: 'Discount too high', code: SALES_ERROR_CODES.DISC_CAP, line: 4 },
      {
        field: 'document',
        message: 'Cash limit',
        code: SALES_ERROR_CODES.CASH_LIMIT,
        statutory: STATUTORY,
      },
    ]);
  });

  it('throwSalesRight is a 403 filed under userId unless told otherwise', () => {
    expect(
      thrownBy(() => throwSalesRight('No post right', SALES_ERROR_CODES.RIGHT_POST)),
    ).toMatchObject({
      status: 403,
      body: { errors: [{ field: 'userId', code: SALES_ERROR_CODES.RIGHT_POST }] },
    });
    expect(
      thrownBy(() => throwSalesRight('No post right', SALES_ERROR_CODES.RIGHT_POST, 'menuId')),
    ).toMatchObject({ body: { errors: [{ field: 'menuId' }] } });
  });

  it('throwSalesInvalid is a 400 for a request that is itself wrong', () => {
    expect(
      thrownBy(() =>
        throwSalesInvalid('Bad year', SALES_ERROR_CODES.YEAR_LOCKED, 'sbAccYear'),
      ),
    ).toMatchObject({
      status: 400,
      body: { errors: [{ field: 'sbAccYear', code: SALES_ERROR_CODES.YEAR_LOCKED }] },
    });
  });
});
