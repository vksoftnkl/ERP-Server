import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { TxnHoldExceptionFilter } from './txn-hold-exception.filter';
// The filter logs the failing route before answering 500, so the host has to
// offer getRequest as well as getResponse.
const createHost = (response: Response) =>
  ({
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ method: 'POST', url: '/v1/txn-holds/x/resume' }) as Request,
    }),
  }) as never;
describe('TxnHoldExceptionFilter', () => {
  let filter: TxnHoldExceptionFilter;
  let status: jest.Mock;
  let json: jest.Mock;
  let response: Response;
  beforeEach(() => {
    filter = new TxnHoldExceptionFilter();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    response = { status } as unknown as Response;
  });
  // The lease refusals: each keeps its own status and its field-level detail, so
  // the till can tell "someone else has it" from "it is finished with".
  it('passes a lease conflict through as 409', () => {
    filter.catch(
      new ConflictException({
        success: false,
        message: 'Hold is LOCKED by device 019c6f6c-be87-7a11-8905-36092c46fe11',
        errors: [{ field: 'txhLockedDeviceId', message: 'Release it on that device first' }],
      }),
      createHost(response),
    );
    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Hold is LOCKED by device 019c6f6c-be87-7a11-8905-36092c46fe11',
      errors: [{ field: 'txhLockedDeviceId', message: 'Release it on that device first' }],
    });
  });
  it('passes an ownership refusal through as 403', () => {
    filter.catch(
      new ForbiddenException({
        success: false,
        message: 'Not leased by this device',
        errors: [{ field: 'txhLockedDeviceId', message: 'The hold is leased by another device' }],
      }),
      createHost(response),
    );
    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Not leased by this device',
      errors: [{ field: 'txhLockedDeviceId', message: 'The hold is leased by another device' }],
    });
  });
  it('passes a missing hold through as 404', () => {
    filter.catch(
      new NotFoundException({
        success: false,
        message: 'Hold not found',
        errors: [{ field: 'txhId', message: 'No active hold found with id x' }],
      }),
      createHost(response),
    );
    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Hold not found',
      errors: [{ field: 'txhId', message: 'No active hold found with id x' }],
    });
  });
  // A raw pipe rejection carries no field, so the filter infers it from the
  // txh-prefixed name in the message.
  it('maps a validation payload onto the txh field it names', () => {
    filter.catch(
      new BadRequestException({ message: ['txhCompanyId must be a valid UUID'] }),
      createHost(response),
    );
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [{ field: 'txhCompanyId', message: 'txhCompanyId must be a valid UUID' }],
    });
  });
  it('falls back to `request` when the message names no field', () => {
    filter.catch(
      new BadRequestException({ message: ['each value must be a string'] }),
      createHost(response),
    );
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [{ field: 'request', message: 'each value must be a string' }],
    });
  });
  it('answers an unknown error with the 500 envelope', () => {
    filter.catch(new Error('boom'), createHost(response));
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Internal server error',
      errors: [],
    });
  });
});
