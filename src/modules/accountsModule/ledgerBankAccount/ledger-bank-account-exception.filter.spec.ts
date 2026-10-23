import { ArgumentsHost, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { LedgerBankAccountExceptionFilter } from './ledger-bank-account-exception.filter';
import { LedgerBankErrorCode } from './types/ledger-bank-account-error-codes';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: 'POST',
        url: '/v1/ledger-bank-accounts/create',
        headers: {},
        query: {},
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('LedgerBankAccountExceptionFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['lbaIfscCode must be longer than or equal to 11 characters', 'lbaIfscCode'],
    ['property ifsc should not exist', 'request'],
  ])('files %p under %s', (message, field) => {
    const { host, status, json } = hostFor();

    new LedgerBankAccountExceptionFilter().catch(
      new BadRequestException({ message: [message] }),
      host,
    );

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
      message: 'Ledger bank account already exists for this ledger',
      errors: [
        {
          field: 'lbaAccountNo',
          message: 'Duplicate',
          code: LedgerBankErrorCode.DUPLICATE_ACCOUNT_NO,
        },
      ],
    };

    new LedgerBankAccountExceptionFilter().catch(new ConflictException(body), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = hostFor();

    new LedgerBankAccountExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
  });
});
