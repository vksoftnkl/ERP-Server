import { ArgumentsHost, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrintTemplateAssignmentExceptionFilter } from '../print-template-assignment/print-template-assignment-exception.filter';
import { PrintTemplateExceptionFilter } from './print-template-exception.filter';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/v1/print-templates', headers: {}, query: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

const fieldOf = (json: jest.Mock): string =>
  (json.mock.calls[0][0] as { errors: Array<{ field: string }> }).errors[0].field;

describe('PrintTemplateExceptionFilter', () => {
  it.each([
    ['ptlCode must be shorter than or equal to 60 characters', 'ptlCode'],
    ['versions.0.ptvBody must be a string', 'ptvBody'],
    ['versions.0.datasets.1.ptdRole must be one of the following values: MASTER, DETAIL', 'ptdRole'],
    ['ptaCopies must be an integer number', 'request'],
  ])('files "%s" under %s', (message, field) => {
    const { host, json } = hostFor();

    new PrintTemplateExceptionFilter().catch(new BadRequestException({ message: [message] }), host);

    expect(fieldOf(json)).toBe(field);
  });

  it('passes a service refusal, with its path into the arrays, through untouched', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'Validation failed',
      errors: [
        {
          field: 'versions[1].datasets[0].ptdSql',
          code: 'PRINT_TEMPLATE_SQL_WRITES',
          message: 'Only a SELECT may be stored',
        },
      ],
    };

    new PrintTemplateExceptionFilter().catch(new BadRequestException(body), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = hostFor();

    new PrintTemplateExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ code: 'INTERNAL_ERROR' })] }),
    );
    jest.restoreAllMocks();
  });
});

describe('PrintTemplateAssignmentExceptionFilter', () => {
  it.each([
    ['ptaOutputMode must be one of the following values: PRINT, PREVIEW', 'ptaOutputMode'],
    ['ptlCode must be a string', 'request'],
  ])('files "%s" under %s', (message, field) => {
    const { host, json } = hostFor();

    new PrintTemplateAssignmentExceptionFilter().catch(
      new BadRequestException({ message: [message] }),
      host,
    );

    expect(fieldOf(json)).toBe(field);
  });

  it('codes a plain Nest exception by its status', () => {
    const { host, status, json } = hostFor();

    new PrintTemplateAssignmentExceptionFilter().catch(new ConflictException('Busy'), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Busy',
      errors: [{ field: 'request', code: 'HTTP_409', message: 'Busy' }],
    });
  });
});
