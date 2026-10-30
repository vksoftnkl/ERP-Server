import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { BatchPrefixExceptionFilter } from './batch-prefix-exception.filter';
import { BATCH_PREFIX_ERROR } from './types/batch-prefix-error-codes';

const hostFor = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'GET', url: '/v1/batch-prefixes/get', headers: {}, query: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('BatchPrefixExceptionFilter', () => {
  it('passes a coded refusal through with its own status and body', () => {
    const { host, status, json } = hostFor();
    const body = {
      success: false,
      message: 'Batch prefix already exists',
      errors: [{ field: 'prefixUsed', message: 'Duplicate', code: BATCH_PREFIX_ERROR.DUPLICATE }],
    };

    new BatchPrefixExceptionFilter().catch(new ConflictException(body), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(body);
  });

  // ParseUUIDPipe on ?id= throws a bare message the filter has to place.
  it('files a bad id from the uuid pipe under id', async () => {
    const { host, status, json } = hostFor();
    const error = await new ParseUUIDPipe({ version: '7' })
      .transform('not-a-uuid', { type: 'query', data: 'id' })
      .catch((e: unknown) => e);

    new BatchPrefixExceptionFilter().catch(error, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [expect.objectContaining({ field: 'id' })],
    });
  });

  it.each([
    ['prefixUsed should not be empty', 'prefixUsed'],
    ['page must be an integer number', 'page'],
    ['limit must not be greater than 100', 'limit'],
    ['search must be a string', 'search'],
    ['property name should not exist', 'request'],
  ])('files %p under %s', (message, field) => {
    const { host, json } = hostFor();

    new BatchPrefixExceptionFilter().catch(new BadRequestException({ message: [message] }), host);

    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [expect.objectContaining({ field, message, code: expect.any(String) as string })],
    });
  });

  it('codes a plain Nest exception by its status', () => {
    const { host, status, json } = hostFor();

    new BatchPrefixExceptionFilter().catch(new NotFoundException(), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        errors: [expect.objectContaining({ field: 'request', code: 'HTTP_404' })],
      }),
    );
  });

  it('answers a non-HTTP failure with a coded 500', () => {
    const { host, status, json } = hostFor();

    new BatchPrefixExceptionFilter().catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Internal server error',
      errors: [{ field: 'request', code: 'INTERNAL_ERROR', message: 'Internal server error' }],
    });
  });
});
