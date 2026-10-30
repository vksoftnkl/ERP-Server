import { ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { ItemGstUnitExceptionFilter } from './item-gst-unit-exception.filter';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'GET', url: '/v1/item-gst-units/get', headers: {}, query: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('ItemGstUnitExceptionFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('files a validation message under the item_gst_unit_ field it names', () => {
    const { host, status, json } = hostFor();

    new ItemGstUnitExceptionFilter().catch(
      new BadRequestException({ message: ['item_gst_unit_code must be a string'] }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [
        {
          field: 'item_gst_unit_code',
          code: 'VALIDATION_FAILED',
          message: 'item_gst_unit_code must be a string',
        },
      ],
    });
  });

  // `search`, the route's only input, does not match the item_gst_unit_ pattern.
  it('files a bad search under request', () => {
    const { host, json } = hostFor();

    new ItemGstUnitExceptionFilter().catch(
      new BadRequestException({
        message: ['search must be shorter than or equal to 200 characters'],
      }),
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
      message: 'Not found',
      errors: [{ field: 'item_gst_unit_id', message: 'Not found', code: 'SOME_NOT_FOUND' }],
    };

    new ItemGstUnitExceptionFilter().catch(new NotFoundException(body), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = hostFor();

    new ItemGstUnitExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
  });
});
