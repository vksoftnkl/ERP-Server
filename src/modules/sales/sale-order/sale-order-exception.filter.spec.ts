import { ArgumentsHost, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { SaleOrderExceptionFilter } from './sale-order-exception.filter';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/v1/sale-orders/create', headers: {}, query: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

const fieldOf = (message: string): string => {
  const { host, json } = hostFor();
  new SaleOrderExceptionFilter().catch(new BadRequestException({ message: [message] }), host);
  const body = json.mock.calls[0][0] as { errors: Array<{ field: string }> };
  return body.errors[0].field;
};

describe('SaleOrderExceptionFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['soCustId must be a valid UUID', 'soCustId'],
    ['items.0.soiOrderQty must not be less than 0', 'soiOrderQty'],
    ['advances.1.soaAmount must be a number', 'soaAmount'],
    ['charges.0.cdAmount must be a number', 'cdAmount'],
    ['tenders.2.tdTenderId must be a valid UUID', 'tdTenderId'],
  ])('files "%s" under %s', (message, field) => {
    expect(fieldOf(message)).toBe(field);
  });

  it("files another document's field under request", () => {
    expect(fieldOf('sbiItemId must be a valid UUID')).toBe('request');
  });

  it('passes a sales refusal through with its own status and body', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'This order is CANCELLED',
      errors: [{ field: 'soId', message: 'This order is CANCELLED', code: 'SALES_DOC_NOT_DRAFT' }],
    };

    new SaleOrderExceptionFilter().catch(new ConflictException(body), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    const { host, status, json } = hostFor();

    new SaleOrderExceptionFilter().catch(new Error('deadlock detected'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })],
      }),
    );
  });
});
