import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DropdownDetailExceptionFilter } from './dropdown-detail-exception.filter';
import { DropdownDetailErrorCode } from './types/dropdown-detail-enum.types';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: 'POST',
        url: '/v1/dropdown-details/create',
        headers: {},
        query: {},
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('DropdownDetailExceptionFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('files each validation message under the dropdown field it names', () => {
    const { host, status, json } = hostFor();

    new DropdownDetailExceptionFilter().catch(
      new BadRequestException({
        message: [
          'dropdown_name should not be empty',
          'columns.0.dropdown_columns_id must be a UUID',
        ],
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [
        {
          field: 'dropdown_name',
          code: 'VALIDATION_FAILED',
          message: 'dropdown_name should not be empty',
        },
        {
          field: 'dropdown_columns_id',
          code: 'VALIDATION_FAILED',
          message: 'columns.0.dropdown_columns_id must be a UUID',
        },
      ],
    });
  });

  it('files a message naming no dropdown field under request', () => {
    const { host, json } = hostFor();

    new DropdownDetailExceptionFilter().catch(
      new BadRequestException({ message: 'property gridId should not exist' }),
      host,
    );

    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [
        {
          field: 'request',
          code: 'VALIDATION_WHITELIST',
          message: 'property gridId should not exist',
        },
      ],
    });
  });

  it('passes a coded refusal through with its own status and body', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'Dropdown details not found',
      errors: [
        {
          field: 'dropdown_id',
          message: 'No dropdown details found with id 42',
          code: DropdownDetailErrorCode.NOT_FOUND,
        },
      ],
    };

    new DropdownDetailExceptionFilter().catch(new NotFoundException(body), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('codes a plain Nest exception by its status', () => {
    const { host, status, json } = hostFor();

    new DropdownDetailExceptionFilter().catch(new ForbiddenException(), host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        errors: [expect.objectContaining({ field: 'request', code: 'HTTP_403' })],
      }),
    );
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = hostFor();

    new DropdownDetailExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
  });
});
