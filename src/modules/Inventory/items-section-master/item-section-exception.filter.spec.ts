import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { ItemSectionExceptionFilter } from './item-section-exception.filter';

const createHost = (response: Response) =>
  ({
    switchToHttp: () => ({
      getResponse: () => response,
    }),
  }) as never;

describe('ItemSectionExceptionFilter', () => {
  let filter: ItemSectionExceptionFilter;
  let status: jest.Mock;
  let json: jest.Mock;
  let response: Response;

  beforeEach(() => {
    filter = new ItemSectionExceptionFilter();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    response = {
      status,
    } as unknown as Response;
  });

  it('passes through standardized error payloads', () => {
    const exception = new NotFoundException({
      success: false,
      message: 'Item section not found',
      errors: [{ field: 'sec_id', message: 'Not found' }],
    });

    filter.catch(exception, createHost(response));

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Item section not found',
      errors: [{ field: 'sec_id', message: 'Not found' }],
    });
  });

  it('maps validation payload to standard error format', () => {
    const exception = new BadRequestException({
      message: ['sec_name should not be empty'],
    });

    filter.catch(exception, createHost(response));

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [
        {
          field: 'sec_name',
          message: 'sec_name should not be empty',
        },
      ],
    });
  });

  it('returns internal server error envelope for unknown errors', () => {
    filter.catch(new Error('boom'), createHost(response));

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Internal server error',
      errors: [],
    });
  });
});
