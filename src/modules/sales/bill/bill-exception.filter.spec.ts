import { ArgumentsHost, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { BillExceptionFilter } from './bill-exception.filter';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/v1/bills/create', headers: {}, query: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

/** The field the filter files one ValidationPipe message under. */
const fieldOf = (message: string): unknown => {
  const { host, json } = hostFor();
  new BillExceptionFilter().catch(new BadRequestException({ message: [message] }), host);
  return (json.mock.calls[0][0] as { errors: { field: string }[] }).errors[0].field;
};

describe('BillExceptionFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['sbCustId must be a valid UUID', 'sbCustId'],
    ['items.0.sbiItemId must be a valid UUID', 'sbiItemId'],
    ['charges.1.cdLedgerId must be a valid UUID', 'cdLedgerId'],
    ['tenders.0.tdAmount must be a number', 'tdAmount'],
    ['remarks should not be empty', 'remarks'],
    ['username should not be empty', 'username'],
    ['reasonId must be a valid UUID', 'reasonId'],
    ['note must be shorter than or equal to 250 characters', 'note'],
    ['approvalId must be a valid UUID', 'approvalId'],
  ])('files "%s" under %s', (message, field) => {
    expect(fieldOf(message)).toBe(field);
  });

  it('files a message naming none of the bill fields under request', () => {
    expect(fieldOf('baseRevision must be an integer number')).toBe('request');
  });

  it('passes a coded sales refusal through untouched', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'This bill is CANCELLED',
      errors: [{ field: 'sbId', message: 'This bill is CANCELLED', code: 'SALES_BILL_CANCELLED' }],
    };

    new BillExceptionFilter().catch(new ConflictException(body), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers an unexpected failure with a coded 500', () => {
    const { host, status, json } = hostFor();

    new BillExceptionFilter().catch(new Error('deadlock detected'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
  });
});
