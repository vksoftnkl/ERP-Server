import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { StockErrorCode } from '../types/stock-error-codes';
import { ItemBatchStockExceptionFilter } from './itemBatchStockExceptionFilter';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: 'GET',
        url: '/v1/item-batch-stock/get',
        headers: {},
        query: {},
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('ItemBatchStockExceptionFilter', () => {
  const filter = new ItemBatchStockExceptionFilter();

  it('passes a coded refusal through with its own status and body', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'Item batch stock not found',
      errors: [{ field: 'scope', code: StockErrorCode.BATCH_STOCK_NOT_FOUND, message: 'none' }],
    };

    filter.catch(new NotFoundException(body), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(body);
  });

  it.each([
    'ibs_acc_year',
    'ibs_company_id',
    'ibs_branch_id',
    'ibs_godown_id',
    'ibs_item_id',
    'ibs_unit_id',
    'ibs_batch_id',
    'ibs_stock_bucket',
    'ibs_is_active',
    'ibs_is_deleted',
    'search',
  ])('files a validation message naming %s under that field', (field) => {
    const { host, status, json } = hostFor();

    filter.catch(new BadRequestException({ message: [`${field} must be a string`] }), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [{ field, code: 'VALIDATION_FAILED', message: `${field} must be a string` }],
    });
  });

  it('files a message naming no known field under request, with its validation code', () => {
    const { host, json } = hostFor();

    filter.catch(new BadRequestException({ message: 'property foo should not exist' }), host);

    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [
        {
          field: 'request',
          code: 'VALIDATION_WHITELIST',
          message: 'property foo should not exist',
        },
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
    const { host, status, json } = hostFor();

    filter.catch(new HttpException('Too many requests', 429), host);

    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Too many requests',
        errors: [expect.objectContaining({ code: 'HTTP_429' })],
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
