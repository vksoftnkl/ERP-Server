import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { StockErrorCode } from '../types/stock-error-codes';
import { ItemStockBalanceExceptionFilter } from './itemStockBalanceExceptionFilter';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: 'GET',
        url: '/v1/item-stock-balance/get',
        headers: {},
        query: {},
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('ItemStockBalanceExceptionFilter', () => {
  const filter = new ItemStockBalanceExceptionFilter();

  it('passes a coded refusal through with its own status and body', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'Item stock balance not found',
      errors: [{ field: 'scope', code: StockErrorCode.BALANCE_NOT_FOUND, message: 'none' }],
    };

    filter.catch(new NotFoundException(body), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(body);
  });

  it.each([
    'isb_acc_year',
    'isb_company_id',
    'isb_branch_id',
    'isb_godown_id',
    'isb_item_id',
    'isb_unit_id',
    'isb_stock_bucket',
  ])('files a validation message naming %s under that field', (field) => {
    const { host, status, json } = hostFor();

    filter.catch(new BadRequestException({ message: `${field} must be a UUID` }), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [{ field, code: 'VALIDATION_FAILED', message: `${field} must be a UUID` }],
    });
  });

  it('files each of several validation messages separately', () => {
    const { host, json } = hostFor();

    filter.catch(
      new BadRequestException({
        message: ['isb_item_id must be a UUID', 'property x should not exist'],
      }),
      host,
    );

    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [
        { field: 'isb_item_id', code: 'VALIDATION_FAILED', message: 'isb_item_id must be a UUID' },
        { field: 'request', code: 'VALIDATION_WHITELIST', message: 'property x should not exist' },
      ],
    });
  });

  it('words an empty validation message as "Validation failed"', () => {
    const { host, json } = hostFor();

    filter.catch(new BadRequestException({ message: '' }), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [expect.objectContaining({ field: 'request', message: 'Validation failed' })],
      }),
    );
  });

  it('codes a plain Nest exception by its status', () => {
    const { host, status, json } = hostFor();

    filter.catch(new ForbiddenException('Not yours'), host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Not yours',
      errors: [{ field: 'request', code: 'HTTP_403', message: 'Not yours' }],
    });
  });

  it('takes a string response body as the message', () => {
    const { host, json } = hostFor();

    filter.catch(new HttpException('Gone', 410), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Gone',
        errors: [expect.objectContaining({ code: 'HTTP_410' })],
      }),
    );
  });

  it("falls back to the exception's own message when the body carries none", () => {
    const { host, json } = hostFor();

    filter.catch(new HttpException({ reason: 'x' }, 409), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'HTTP_409' })] }),
    );
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    const { host, status, json } = hostFor();

    filter.catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Internal server error',
      errors: [{ field: 'request', code: 'INTERNAL_ERROR', message: 'Internal server error' }],
    });
  });
});
