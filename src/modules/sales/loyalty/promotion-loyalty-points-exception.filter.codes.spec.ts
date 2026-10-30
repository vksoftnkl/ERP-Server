import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PromotionLoyaltyPointsExceptionFilter } from './promotion-loyalty-points-exception.filter';
import { LoyaltyErrorCode } from './types/loyalty-error-codes';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: 'POST',
        url: '/v1/promotion-loyalty-points/create',
        headers: {},
        query: {},
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

/**
 * Notes 119 / 127 §5 — every body this filter writes carries a coded error.
 * The neighbouring promotion-loyalty-points-exception.filter.spec.ts predates
 * the HTTP_<status> coding; this one pins what the filter answers today.
 */
describe('PromotionLoyaltyPointsExceptionFilter — coded bodies', () => {
  let filter: PromotionLoyaltyPointsExceptionFilter;
  let logError: jest.SpyInstance;

  beforeEach(() => {
    filter = new PromotionLoyaltyPointsExceptionFilter();
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('codes a plain Nest exception by its status rather than leaving errors empty', () => {
    const { host, status, json } = hostFor();

    filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Not found',
      errors: [{ field: 'request', code: 'HTTP_404', message: 'Not found' }],
    });
  });

  it('files a grid-row message under the snake_case field it names', () => {
    const { host, json } = hostFor();

    filter.catch(
      new BadRequestException({ message: ['gifts.0.lsg_redeem_points must not be less than 0'] }),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [
          expect.objectContaining({ field: 'lsg_redeem_points', code: 'VALIDATION_FAILED' }),
        ],
      }),
    );
  });

  it('codes a non-whitelisted property as VALIDATION_WHITELIST', () => {
    const { host, json } = hostFor();

    filter.catch(new BadRequestException({ message: ['property lscFoo should not exist'] }), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [expect.objectContaining({ field: 'request', code: 'VALIDATION_WHITELIST' })],
      }),
    );
  });

  it('passes a coded service refusal through with its own status', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'Loyalty scheme not found',
      errors: [
        {
          field: 'lsc_id',
          message: 'lsc_id x was not found',
          code: LoyaltyErrorCode.SCHEME_NOT_FOUND,
        },
      ],
    };

    filter.catch(new NotFoundException(body), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers a numeric overflow with a coded 422', () => {
    const { host, status, json } = hostFor();

    filter.catch(Object.assign(new Error('raw'), { code: 'P2010', meta: { code: '22003' } }), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [expect.objectContaining({ field: 'request', code: 'VALUE_TOO_LARGE' })],
      }),
    );
  });

  it('logs the failing route before answering a coded 500', () => {
    const { host, status, json } = hostFor();

    filter.catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
    expect(logError).toHaveBeenCalledWith(
      'POST /v1/promotion-loyalty-points/create',
      expect.stringContaining('boom'),
    );
  });
});
