import { BadRequestException, HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { ItemGroupExceptionFilter } from './item-group-exception.filter';

const createHost = (response: Response) =>
  ({
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ method: 'POST', url: '/test' }),
    }),
  }) as never;

describe('ItemGroupExceptionFilter', () => {
  let filter: ItemGroupExceptionFilter;
  let status: jest.Mock;
  let json: jest.Mock;
  let response: Response;

  beforeEach(() => {
    filter = new ItemGroupExceptionFilter();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    response = {
      status,
    } as unknown as Response;
  });

  afterEach(() => jest.restoreAllMocks());

  it('passes through standardized error payloads', () => {
    const exception = new NotFoundException({
      success: false,
      message: 'Item group not found',
      errors: [{ field: 'itg_id', message: 'Not found' }],
    });

    filter.catch(exception, createHost(response));

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Item group not found',
      errors: [{ field: 'itg_id', message: 'Not found' }],
    });
  });

  it('maps validation payload to standard error format', () => {
    const exception = new BadRequestException({
      message: ['itg_name should not be empty'],
    });

    filter.catch(exception, createHost(response));

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [
        {
          field: 'itg_name',
          code: 'VALIDATION_FAILED',
          message: 'itg_name should not be empty',
        },
      ],
    });
  });

  it('returns internal server error envelope for unknown errors', () => {
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    filter.catch(new Error('boom'), createHost(response));

    // The stack goes to the server log, never to the client.
    expect(logged).toHaveBeenCalledWith('POST /test', expect.stringContaining('boom'));

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Internal server error',
      errors: [{ field: 'request', code: 'INTERNAL_ERROR', message: 'Internal server error' }],
    });
  });
});
