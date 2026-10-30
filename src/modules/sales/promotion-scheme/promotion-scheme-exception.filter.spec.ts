import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PromotionSchemeExceptionFilter } from './promotion-scheme-exception.filter';
import { PromotionSchemeErrorCode } from './types/promotion-scheme-error-codes';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: 'POST',
        url: '/v1/promotion-scheme/create',
        headers: {},
        query: {},
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

/**
 * The promotion scheme body is snake_case (prm_*, prb_*, prp_*, pri_*, prs_*),
 * so the filter files a ValidationPipe message under the first snake_case word
 * it names — including one nested in a grid row path.
 */
describe('PromotionSchemeExceptionFilter', () => {
  let filter: PromotionSchemeExceptionFilter;
  let logError: jest.SpyInstance;

  beforeEach(() => {
    filter = new PromotionSchemeExceptionFilter();
    // The 500 branch logs the stack; keep the test output clean.
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('files a header validation message under the field it names', () => {
    const { host, status, json } = hostFor();

    filter.catch(
      new BadRequestException({
        message: ['prm_code must be shorter than or equal to 30 characters'],
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [
        {
          field: 'prm_code',
          code: 'VALIDATION_FAILED',
          message: 'prm_code must be shorter than or equal to 30 characters',
        },
      ],
    });
  });

  it('reaches past the grid path to the row field', () => {
    const { host, json } = hostFor();

    filter.catch(
      new BadRequestException({ message: ['slabs.0.prs_disc_perc must not be greater than 100'] }),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [expect.objectContaining({ field: 'prs_disc_perc', code: 'VALIDATION_FAILED' })],
      }),
    );
  });

  it('files a message that names no snake_case field under request', () => {
    const { host, json } = hostFor();

    filter.catch(new BadRequestException({ message: 'prmCode must be a string' }), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [
          expect.objectContaining({ field: 'request', message: 'prmCode must be a string' }),
        ],
      }),
    );
  });

  it('codes a parameter pipe failure by what it expected', () => {
    const { host, json } = hostFor();

    filter.catch(
      new BadRequestException({ message: 'Validation failed (uuid is expected)' }),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [expect.objectContaining({ field: 'request', code: 'VALIDATION_IS_UUID' })],
      }),
    );
  });

  it('passes a coded service refusal through with its own status and body', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'Duplicate promotion code',
      errors: [
        {
          field: 'prm_code',
          message: 'prm_code SUMMER already exists for this company',
          code: PromotionSchemeErrorCode.CODE_EXISTS,
        },
      ],
    };

    filter.catch(new ConflictException(body), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('codes a plain HTTP exception by its status', () => {
    const { host, status, json } = hostFor();

    filter.catch(new HttpException('Gone', HttpStatus.GONE), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.GONE);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Gone',
      errors: [{ field: 'request', code: 'HTTP_410', message: 'Gone' }],
    });
  });

  it('answers a numeric overflow with a 422 naming the bound', () => {
    const { host, status, json } = hostFor();
    const overflow = Object.assign(new Error('raw query failed'), {
      code: 'P2010',
      meta: { code: '22003' },
    });

    filter.catch(overflow, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'A value is too large to save: numeric field overflow',
      errors: [
        {
          field: 'request',
          code: 'VALUE_TOO_LARGE',
          message: 'A value is too large to save: numeric field overflow',
        },
      ],
    });
  });

  it('answers anything else with a coded 500 and logs the route', () => {
    const { host, status, json } = hostFor();

    filter.catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Internal server error',
      errors: [{ field: 'request', code: 'INTERNAL_ERROR', message: 'Internal server error' }],
    });
    expect(logError).toHaveBeenCalledWith(
      'POST /v1/promotion-scheme/create',
      expect.stringContaining('connection reset'),
    );
  });
});
