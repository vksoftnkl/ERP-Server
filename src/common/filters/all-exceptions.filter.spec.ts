import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { setErrorWording } from '../error-wording/error-wording';
import { AllExceptionsFilter } from './all-exceptions.filter';

const URL = '/api/v1/items/get?id=1';

const run = (exception: unknown) => {
  // The body is read back field by field, so it is left loosely typed.
  const json = jest.fn((_body: any) => undefined);
  const status = jest.fn((_code: number) => ({ json }));
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'POST', url: URL, headers: {} }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(exception, host);

  return { status: status.mock.calls[0]?.[0] as number, body: json.mock.calls[0]?.[0] };
};

describe('AllExceptionsFilter', () => {
  let logError: jest.SpyInstance;

  beforeEach(() => {
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logError.mockRestore();
    setErrorWording([], null);
  });

  // Notes 119: errors[0].code must stay at the top level for the client.
  it('sends a house-shaped refusal as it is, plus status, path and timestamp', () => {
    const { status, body } = run(
      new ConflictException({
        success: false,
        message: 'Item code already used',
        errors: [{ field: 'itemCode', code: 'ITEM_CODE_DUPLICATE', message: 'taken' }],
      }),
    );

    expect(status).toBe(409);
    expect(body).toEqual({
      success: false,
      message: 'Item code already used',
      errors: [{ field: 'itemCode', code: 'ITEM_CODE_DUPLICATE', message: 'taken' }],
      statusCode: 409,
      path: URL,
      timestamp: expect.any(String),
    });
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('does not treat a body with success:false but no errors[] as house-shaped', () => {
    const { body } = run(new ConflictException({ success: false, message: 'x' }));

    expect(body.message).toEqual({ success: false, message: 'x' });
    expect(body.errors).toEqual([{ field: 'request', code: 'HTTP_409', message: 'x' }]);
  });

  it('answers an unexpected Error with 500 INTERNAL_ERROR and logs its stack', () => {
    const boom = new Error('db down');
    const { status, body } = run(boom);

    expect(status).toBe(500);
    expect(body).toEqual({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
      errors: [{ field: 'request', code: 'INTERNAL_ERROR', message: 'Internal server error' }],
      path: URL,
      timestamp: expect.any(String),
    });
    expect(logError).toHaveBeenCalledWith(`POST ${URL}`, boom.stack);
  });

  it('logs a thrown non-Error as JSON', () => {
    const { status } = run({ reason: 'odd' });

    expect(status).toBe(500);
    expect(logError).toHaveBeenCalledWith(`POST ${URL}`, '{"reason":"odd"}');
  });

  it('logs a 5xx HttpException but never a 4xx', () => {
    run(new HttpException('gateway', 502));
    run(new NotFoundException());

    expect(logError).toHaveBeenCalledTimes(1);
  });

  it('keeps the INTERNAL_ERROR code on a 5xx HttpException, whatever its message', () => {
    const { status, body } = run(new HttpException('upstream timed out', 504));

    expect(status).toBe(504);
    expect(body.message).toBe('upstream timed out');
    expect(body.errors[0].code).toBe('INTERNAL_ERROR');
  });

  describe('a 400 from a framework pipe', () => {
    it('codes each line of a ValidationPipe message array', () => {
      const { body } = run(
        new BadRequestException(['property foo should not exist', 'name must be a string']),
      );

      expect(body.errors).toEqual([
        { field: 'request', code: 'VALIDATION_WHITELIST', message: 'property foo should not exist' },
        { field: 'request', code: 'VALIDATION_FAILED', message: 'name must be a string' },
      ]);
    });

    it.each([
      ['Validation failed (uuid is expected)', 'VALIDATION_IS_UUID'],
      ['Validation failed (numeric string is expected)', 'VALIDATION_IS_INT'],
      ['Validation failed (boolean string is expected)', 'VALIDATION_IS_BOOLEAN'],
    ])('codes the parse-pipe message "%s" as %s', (message, code) => {
      const { status, body } = run(new BadRequestException(message));

      expect(status).toBe(400);
      expect(body.errors).toEqual([{ field: 'request', code, message }]);
    });

    it('drops empty and non-text message lines', () => {
      const { body } = run(new BadRequestException({ message: ['', 7, 'bad'] }));

      expect(body.errors).toEqual([{ field: 'request', code: 'VALIDATION_FAILED', message: 'bad' }]);
    });

    it('takes a plain string body as the message', () => {
      const { body } = run(new HttpException('Bad things', 400));

      expect(body.errors).toEqual([
        { field: 'request', code: 'VALIDATION_FAILED', message: 'Bad things' },
      ]);
    });
  });

  // Notes 127 §5: no refusal leaves without a code.
  describe('any other plain 4xx', () => {
    it('codes a NotFoundException HTTP_404 with its message', () => {
      const { status, body } = run(new NotFoundException('Item 9 not found'));

      expect(status).toBe(404);
      expect(body.errors).toEqual([
        { field: 'request', code: 'HTTP_404', message: 'Item 9 not found' },
      ]);
    });

    it('takes a plain string body as the message', () => {
      const { body } = run(new HttpException('Too many', 429));

      expect(body.errors).toEqual([{ field: 'request', code: 'HTTP_429', message: 'Too many' }]);
    });

    it('falls back to "HTTP <status>" when the body has no message', () => {
      const { body } = run(new HttpException({}, 409));

      expect(body.errors).toEqual([{ field: 'request', code: 'HTTP_409', message: 'HTTP 409' }]);
    });
  });

  // Notes 120: every coded error goes out with its plain words.
  it('adds the catalogue words to a coded error', () => {
    setErrorWording(
      [
        {
          code: 'HTTP_404',
          variant: '',
          lang: 'en',
          title: 'Not found',
          line: 'That record is gone.',
          todo: 'Refresh the list.',
        },
      ],
      'v1',
    );

    const { body } = run(new NotFoundException('Item 9 not found'));

    expect(body.errors[0].user).toEqual({
      title: 'Not found',
      line: 'That record is gone.',
      todo: 'Refresh the list.',
    });
  });
});
