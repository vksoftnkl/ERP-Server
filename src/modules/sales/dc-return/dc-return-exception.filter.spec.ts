import { ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { DcReturnExceptionFilter } from './dc-return-exception.filter';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/v1/dc-returns/post', headers: {}, query: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

const fieldOf = (message: string): unknown => {
  const { host, json } = hostFor();
  new DcReturnExceptionFilter().catch(new BadRequestException({ message: [message] }), host);
  return (json.mock.calls[0][0] as { errors: Array<{ field: string }> }).errors[0].field;
};

describe('DcReturnExceptionFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['sdrDcId must be a valid UUID', 'sdrDcId'],
    ['items.0.sdriBucket must be one of SALEABLE, DAMAGED', 'sdriBucket'],
    ['reason should not be empty', 'reason'],
    ['transport.direction must be one of the following values: OUTWARD, INWARD', 'transport'],
    ['sbCustId must be a valid UUID', 'request'],
  ])('files "%s" under %s', (message, field) => {
    expect(fieldOf(message)).toBe(field);
  });

  it('passes a coded sales refusal through with its own status and body', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'DC return cannot be posted',
      errors: [{ field: 'items', message: 'over', code: 'SALES_DCR_OVER_OPEN' }],
    };

    new DcReturnExceptionFilter().catch(new NotFoundException(body), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = hostFor();

    new DcReturnExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
  });
});
