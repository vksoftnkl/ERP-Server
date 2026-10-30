import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { WIDGET_ERROR } from './types/widget-master-error-codes';
import { WidgetMasterExceptionFilter } from './widget-master-exception.filter';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: 'POST',
        url: '/v1/widget-masters/create',
        headers: {},
        query: {},
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('WidgetMasterExceptionFilter', () => {
  it('passes a coded refusal through with its own status and body', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'Section not found',
      errors: [{ field: 'sectionId', message: 'none', code: WIDGET_ERROR.SECTION_NOT_FOUND }],
    };

    new WidgetMasterExceptionFilter().catch(new NotFoundException(body), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(body);
  });

  it.each([
    [
      'sectionPlatform must be one of the following values: Mobile, Desktop, Web',
      'sectionPlatform',
    ],
    ['fieldName should not be empty', 'fieldName'],
    ['property label should not exist', 'request'],
  ])('files %p under %s', (message, field) => {
    const { host, status, json } = hostFor();

    new WidgetMasterExceptionFilter().catch(new BadRequestException({ message: [message] }), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [expect.objectContaining({ field, message, code: expect.any(String) as string })],
    });
  });

  // ParseIntPipe on ?sectionId= throws a bare message.
  it('files a ParseIntPipe message under request', () => {
    const { host, json } = hostFor();

    new WidgetMasterExceptionFilter().catch(
      new BadRequestException('Validation failed (numeric string is expected)'),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: [expect.objectContaining({ field: 'request' })] }),
    );
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    const { host, status, json } = hostFor();

    new WidgetMasterExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Internal server error',
      errors: [{ field: 'request', code: 'INTERNAL_ERROR', message: 'Internal server error' }],
    });
  });
});
