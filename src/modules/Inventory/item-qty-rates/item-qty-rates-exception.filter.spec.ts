import { ArgumentsHost, BadRequestException, ConflictException } from '@nestjs/common';
import { ItemQtyRatesExceptionFilter, qtyRatesFieldOf } from './item-qty-rates-exception.filter';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: 'POST',
        url: '/v1/item-qty-prices/save-with-rates',
        headers: {},
        query: {},
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

/** Review fix C-e — a validation sentence inside slabs[] is filed under its slab, not `request`. */
describe('ItemQtyRatesExceptionFilter', () => {
  it('names the path a sentence starts with: a slab, a card row, a delete, a slab column', () => {
    expect(qtyRatesFieldOf('slabs.2.iqp_from_qty must be a number')).toBe('slabs.2.iqp_from_qty');
    expect(qtyRatesFieldOf('slabs.0.foo should not exist')).toBe('slabs.0.foo');
    expect(qtyRatesFieldOf('rates.rows.1.levels.0.price must not be less than 0')).toBe(
      'rates.rows.1.levels.0.price',
    );
    expect(qtyRatesFieldOf('deleteSlabIds.3 must be a UUID')).toBe('deleteSlabIds.3');
    expect(qtyRatesFieldOf('iqp_price_mode must be one of P, R, F')).toBe('iqp_price_mode');
    expect(qtyRatesFieldOf('ipm_cost_price is too large')).toBe('ipm_cost_price');
    expect(qtyRatesFieldOf('something else went wrong')).toBe('request');
  });

  it("files Nest's { message: [...] } list under slabs.<i>.<field>, coded", () => {
    const { host, status, json } = hostFor();

    new ItemQtyRatesExceptionFilter().catch(
      new BadRequestException({
        message: [
          'slabs.1.iqp_from_qty must be a number conforming to the specified constraints',
          'slabs.1.foo should not exist',
        ],
        error: 'Bad Request',
        statusCode: 400,
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [
        expect.objectContaining({ field: 'slabs.1.iqp_from_qty', code: 'VALIDATION_FAILED' }),
        expect.objectContaining({ field: 'slabs.1.foo', code: 'VALIDATION_WHITELIST' }),
      ],
    });
  });

  it('passes the house body through with its own fields and status', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'Qty price slabs overlap',
      errors: [{ field: 'slabs.1.iqp_from_qty', code: 'ITEM_QTY_PRICE_OVERLAP', message: 'x' }],
    };

    new ItemQtyRatesExceptionFilter().catch(new ConflictException(body), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(body);
  });
});
