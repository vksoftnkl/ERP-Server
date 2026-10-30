import { ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { ItemTaxHistoryExceptionFilter } from './item-tax-history-exception.filter';
import { ItemTaxHistoryErrorCode } from './types/item-tax-history-error-codes';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: 'POST',
        url: '/v1/item-tax-histories/create',
        headers: {},
        query: {},
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('ItemTaxHistoryExceptionFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('files a validation message under the ith_ field it names', () => {
    const { host, status, json } = hostFor();

    new ItemTaxHistoryExceptionFilter().catch(
      new BadRequestException({ message: ['ith_tax_id must be a UUID'] }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [
        { field: 'ith_tax_id', code: 'VALIDATION_FAILED', message: 'ith_tax_id must be a UUID' },
      ],
    });
  });

  it("files another master's field under request", () => {
    const { host, json } = hostFor();

    new ItemTaxHistoryExceptionFilter().catch(
      new BadRequestException({ message: 'iqp_item_id must be a UUID' }),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ field: 'request' })] }),
    );
  });

  it('passes a coded refusal through with its own status and body', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'Item tax history not found',
      errors: [
        {
          field: 'ith_id',
          message: 'No item tax history',
          code: ItemTaxHistoryErrorCode.NOT_FOUND,
        },
      ],
    };

    new ItemTaxHistoryExceptionFilter().catch(new NotFoundException(body), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = hostFor();

    new ItemTaxHistoryExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
  });
});
