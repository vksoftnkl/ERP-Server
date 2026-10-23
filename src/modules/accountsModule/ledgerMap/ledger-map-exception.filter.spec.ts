import { ArgumentsHost, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { LedgerMapExceptionFilter } from './ledger-map-exception.filter';
import { LedgerMapErrorCode } from './types/ledger-map-error-codes';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/v1/ledger-map/create', headers: {}, query: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('LedgerMapExceptionFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['almCompanyId is not accepted — /ledger-map manages the shared mapping only', 'almCompanyId'],
    ['ledgerId must be a UUID', 'ledgerId'],
    ['role should not be empty', 'role'],
    ['isActive must be a boolean value', 'isActive'],
    ['remarks must be shorter than or equal to 250 characters', 'remarks'],
    ['property ledger should not exist', 'request'],
  ])('files %p under %s', (message, field) => {
    const { host, status, json } = hostFor();

    new LedgerMapExceptionFilter().catch(new BadRequestException({ message: [message] }), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [expect.objectContaining({ field, message })],
    });
  });

  it('passes a coded refusal through with its own status and body', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'Posting role is in use',
      errors: [{ field: 'almId', message: 'in use', code: LedgerMapErrorCode.ROLE_IN_USE }],
    };

    new LedgerMapExceptionFilter().catch(new ConflictException(body), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = hostFor();

    new LedgerMapExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
  });
});
