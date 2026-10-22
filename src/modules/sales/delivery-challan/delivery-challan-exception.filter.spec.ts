import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { DeliveryChallanExceptionFilter } from './delivery-challan-exception.filter';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: 'POST',
        url: '/v1/delivery-challans/post',
        headers: {},
        query: {},
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

type ErrorBody = { message: string; errors: Array<{ field: string; code: string }> };

const bodyOf = (exception: unknown): ErrorBody => {
  const { host, json } = hostFor();
  new DeliveryChallanExceptionFilter().catch(exception, host);
  return json.mock.calls[0][0] as ErrorBody;
};

const fieldOf = (message: string): string =>
  bodyOf(new BadRequestException({ message: [message] })).errors[0].field;

describe('DeliveryChallanExceptionFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['sdcCustId must be a UUID', 'sdcCustId'],
    ['items.0.sdiBucket must be one of SALEABLE, DAMAGED — omit it for SALEABLE', 'sdiBucket'],
    ['charges.0.cdAmount must be a number', 'cdAmount'],
    ['tenders.0.tdTenderTypeId must be an integer', 'tdTenderTypeId'],
    ['reason should not be empty', 'reason'],
    ['remark should not be empty', 'remark'],
    ['purpose must be one of the following values: SUPPLY, JOB_WORK', 'purpose'],
    ['baseRevision must not be less than 1', 'baseRevision'],
    ['editRemark should not be empty', 'editRemark'],
    ['transport.transporterName must be shorter than or equal to 100 characters', 'transport'],
    ['srCustId must be a UUID', 'request'],
    ['overrides must be an array', 'request'],
  ])('files "%s" under %s', (message, field) => {
    expect(fieldOf(message)).toBe(field);
  });

  it('answers a validation failure with a 400 listing every message', () => {
    const { host, status, json } = hostFor();

    new DeliveryChallanExceptionFilter().catch(
      new BadRequestException({
        message: ['sdcAccYear should not be empty', 'post must be a boolean value'],
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [
        {
          field: 'sdcAccYear',
          code: 'VALIDATION_FAILED',
          message: 'sdcAccYear should not be empty',
        },
        { field: 'request', code: 'VALIDATION_FAILED', message: 'post must be a boolean value' },
      ],
    });
  });

  it('codes a query id the ParseUUIDPipe refused', () => {
    expect(
      bodyOf(new BadRequestException('Validation failed (uuid v 7 is expected)')).errors,
    ).toEqual([
      {
        field: 'request',
        code: 'VALIDATION_IS_UUID',
        message: 'Validation failed (uuid v 7 is expected)',
      },
    ]);
  });

  it('passes a coded sales refusal through with its own status and body', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'This challan is CANCELLED',
      errors: [
        { field: 'sdcId', message: 'This challan is CANCELLED', code: 'SALES_DOC_CANCELLED' },
      ],
    };

    new DeliveryChallanExceptionFilter().catch(new ConflictException(body), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('codes a plain Nest exception by its status', () => {
    const { host, status, json } = hostFor();

    new DeliveryChallanExceptionFilter().catch(new ForbiddenException('Not yours'), host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Not yours',
      errors: [{ field: 'request', code: 'HTTP_403', message: 'Not yours' }],
    });
  });

  it('answers a non-HTTP failure with a coded 500 and logs the request', () => {
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = hostFor();

    new DeliveryChallanExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Internal server error',
      errors: [{ field: 'request', code: 'INTERNAL_ERROR', message: 'Internal server error' }],
    });
    expect(logged).toHaveBeenCalledWith('POST /v1/delivery-challans/post', expect.any(String));
  });
});
