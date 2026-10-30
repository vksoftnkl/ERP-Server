import {
  ArgumentsHost,
  BadRequestException,
  ExceptionFilter,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BankListExceptionFilter } from './bank-list/bank-list-exception.filter';
import { DeviceListMasterExceptionFilter } from './device-list-master/device-list-master-exception.filter';
import { StateCodeMasterExceptionFilter } from './state-code-master/state-code-master-exception.filter';
import { UiTableMasterExceptionFilter } from './ui-table-master/ui-table-master-exception.filter';
import { UserLoginSessionsExceptionFilter } from './user-login-sessions/user-login-sessions-exception.filter';

/**
 * Each filter differs from the shared ModuleExceptionFilter only in the regex
 * that pulls a field name out of a ValidationPipe message, so that is what is
 * pinned here: a message naming one of the module's fields is filed under that
 * field, anything else under `request`.
 */
const FILTERS: Array<{
  name: string;
  create: () => ExceptionFilter;
  ownField: string;
  foreignField: string;
}> = [
  {
    name: 'BankListExceptionFilter',
    create: () => new BankListExceptionFilter(),
    ownField: 'bnkName',
    foreignField: 'devDeviceUid',
  },
  {
    name: 'DeviceListMasterExceptionFilter',
    create: () => new DeviceListMasterExceptionFilter(),
    ownField: 'devDeviceUid',
    foreignField: 'bnkName',
  },
  {
    name: 'StateCodeMasterExceptionFilter',
    create: () => new StateCodeMasterExceptionFilter(),
    ownField: 'tinCode',
    // The state filter names its fields one by one; the audit columns are not among them.
    foreignField: 'createdBy',
  },
  {
    name: 'UiTableMasterExceptionFilter',
    create: () => new UiTableMasterExceptionFilter(),
    ownField: 'uiTblClmName',
    foreignField: 'ulsUserId',
  },
  {
    name: 'UserLoginSessionsExceptionFilter',
    create: () => new UserLoginSessionsExceptionFilter(),
    ownField: 'ulsIpAddress',
    foreignField: 'uiTblName',
  },
];

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/v1/fixed', headers: {}, query: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe.each(FILTERS)('$name', ({ create, ownField, foreignField }) => {
  beforeEach(() => {
    // The 500 branch logs the stack; keep the test output clean.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('files a validation message under the field it names', () => {
    const { host, status, json } = hostFor();

    create().catch(new BadRequestException({ message: [`${ownField} must be a string`] }), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [
        { field: ownField, code: 'VALIDATION_FAILED', message: `${ownField} must be a string` },
      ],
    });
  });

  it("files another module's field under request", () => {
    const { host, json } = hostFor();

    create().catch(new BadRequestException({ message: `${foreignField} must be a string` }), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ field: 'request' })] }),
    );
  });

  it('codes a non-whitelisted property as VALIDATION_WHITELIST', () => {
    const { host, json } = hostFor();

    create().catch(new BadRequestException({ message: ['property extra should not exist'] }), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [expect.objectContaining({ field: 'request', code: 'VALIDATION_WHITELIST' })],
      }),
    );
  });

  it('passes a house refusal through with its own status and body', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'Not found',
      errors: [{ field: ownField, message: 'Not found', code: 'SOME_NOT_FOUND' }],
    };

    create().catch(new NotFoundException(body), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    const { host, status, json } = hostFor();

    create().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Internal server error',
      errors: [{ field: 'request', code: 'INTERNAL_ERROR', message: 'Internal server error' }],
    });
  });
});
