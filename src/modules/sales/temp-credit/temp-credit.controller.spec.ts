import { ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { TempCreditController, TempCreditExceptionFilter } from './temp-credit.controller';
import { TempCreditService } from './temp-credit.service';
import { TempCreditErrorCode } from './types/temp-credit-error-codes';

const ATC_ID = '019c6f6c-be87-7a11-8905-36092c46e301';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e302';
const ACC_YEAR = '2026-2027';

describe('TempCreditController', () => {
  let service: { open: jest.Mock; followUp: jest.Mock; remove: jest.Mock };
  let controller: TempCreditController;

  beforeEach(() => {
    service = {
      open: jest.fn().mockResolvedValue([{ atcId: ATC_ID }]),
      followUp: jest.fn().mockResolvedValue({ atcId: ATC_ID, remarks: 'Called' }),
      remove: jest.fn().mockResolvedValue({ atcId: ATC_ID, deleted: true }),
    };
    controller = new TempCreditController(service as unknown as TempCreditService);
  });

  it('wraps the open credits', async () => {
    const query = { companyId: COMPANY_ID, overdueOnly: true };

    await expect(controller.open(query)).resolves.toEqual({
      success: true,
      message: 'Temporary credits fetched',
      data: [{ atcId: ATC_ID }],
    });
    expect(service.open).toHaveBeenCalledWith(query);
  });

  it('wraps a follow-up', async () => {
    const body = { atcId: ATC_ID, atcAccYear: ACC_YEAR, remarks: 'Called' };

    await expect(controller.followUp(body)).resolves.toEqual({
      success: true,
      message: 'Follow-up recorded',
      data: { atcId: ATC_ID, remarks: 'Called' },
    });
    expect(service.followUp).toHaveBeenCalledWith(body);
  });

  it('wraps a delete', async () => {
    const body = { atcId: ATC_ID, atcAccYear: ACC_YEAR, reason: 'Moved away' };

    await expect(controller.remove(body)).resolves.toEqual({
      success: true,
      message: 'Temporary credit deleted',
      data: { atcId: ATC_ID, deleted: true },
    });
    expect(service.remove).toHaveBeenCalledWith(body);
  });
});

describe('TempCreditExceptionFilter', () => {
  const hostFor = () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ method: 'PUT', url: '/v1/temp-credits/follow-up', headers: {} }),
      }),
    } as unknown as ArgumentsHost;
    return { host, status, json };
  };

  beforeEach(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['atcAccYear must be shorter than or equal to 9 characters', 'atcAccYear'],
    ['companyId must be a valid UUID', 'companyId'],
    ['remarks should not be empty', 'remarks'],
    ['reason should not be empty', 'reason'],
    ['promiseDate must be a valid ISO 8601 date string', 'promiseDate'],
    ['cusName must be a string', 'request'],
  ])('files "%s" under %s', (message, field) => {
    const { host, json } = hostFor();

    new TempCreditExceptionFilter().catch(new BadRequestException({ message: [message] }), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ field, message })] }),
    );
  });

  it('passes a coded refusal through unchanged', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'Temporary credit not found',
      errors: [{ field: 'atcId', message: 'gone', code: TempCreditErrorCode.NOT_FOUND }],
    };

    new TempCreditExceptionFilter().catch(new NotFoundException(body), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    const { host, status } = hostFor();

    new TempCreditExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
  });
});
