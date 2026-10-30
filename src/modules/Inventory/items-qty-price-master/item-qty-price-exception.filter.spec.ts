import { ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { ItemQtyPriceExceptionFilter } from './item-qty-price-exception.filter';
import { ItemQtyPriceErrorCode } from './types/item-qty-price-error-codes';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: 'POST',
        url: '/v1/item-qty-prices/create',
        headers: {},
        query: {},
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('ItemQtyPriceExceptionFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('files a validation message under the iqp_ field it names', () => {
    const { host, status, json } = hostFor();

    new ItemQtyPriceExceptionFilter().catch(
      new BadRequestException({ message: ['iqp_price_mode must be one of P, R, F'] }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [
        {
          field: 'iqp_price_mode',
          code: 'VALIDATION_FAILED',
          message: 'iqp_price_mode must be one of P, R, F',
        },
      ],
    });
  });

  it("files another master's field under request", () => {
    const { host, json } = hostFor();

    new ItemQtyPriceExceptionFilter().catch(
      new BadRequestException({ message: 'ipm_item_id must be a UUID' }),
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
      message: 'Item qty price not found',
      errors: [
        {
          field: 'iqp_id',
          message: 'No item qty price found',
          code: ItemQtyPriceErrorCode.NOT_FOUND,
        },
      ],
    };

    new ItemQtyPriceExceptionFilter().catch(new NotFoundException(body), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = hostFor();

    new ItemQtyPriceExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
  });
});
