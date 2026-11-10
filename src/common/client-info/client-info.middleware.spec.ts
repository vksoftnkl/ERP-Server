import { EventEmitter } from 'node:events';
import type { NextFunction, Request, Response } from 'express';
import { createClientInfoMiddleware, errorCodesOf } from './client-info.middleware';

type FakeResponse = EventEmitter & { statusCode: number; json: jest.Mock; sent?: unknown };

function fakeResponse(): FakeResponse {
  const response = new EventEmitter() as FakeResponse;
  response.statusCode = 200;
  response.json = jest.fn(function (this: FakeResponse, body: unknown) {
    this.sent = body;
    return this;
  });
  return response;
}

function run(headers: Record<string, string>, extra: Partial<Request> = {}) {
  const sink = { warn: jest.fn(), error: jest.fn() };
  const request = {
    method: 'POST',
    originalUrl: '/api/v1/app-version/releases?x=1',
    headers,
    ...extra,
  } as unknown as Request & { clientInfo?: unknown };
  const response = fakeResponse();
  const next = jest.fn() as NextFunction;
  createClientInfoMiddleware(sink)(request, response as unknown as Response, next);
  return { sink, request, response, next };
}

const NEW_BUILD = { 'x-app-platform': 'desktop', 'x-app-build': '10', 'x-device-id': 'pc-1' };
const USER = { sub: 'u-1', user_name: 'tester1', company_id: 'c-1' };

describe('client-info middleware (Part B Step 2)', () => {
  it('attaches clientInfo and always calls next', () => {
    const { request, next } = run(NEW_BUILD);
    expect(request.clientInfo).toMatchObject({ platform: 'desktop', build: 10, deviceId: 'pc-1' });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('logs a 4xx with its codes, platform, build, company and user', () => {
    const { sink, response } = run(NEW_BUILD, { user: USER } as never);
    response.statusCode = 409;
    response.json({ success: false, errors: [{ code: 'APP_RELEASE_BUILD_EXISTS' }] });
    response.emit('finish');
    expect(response.sent).toEqual({
      success: false,
      errors: [{ code: 'APP_RELEASE_BUILD_EXISTS' }],
    });
    expect(sink.warn).toHaveBeenCalledWith(
      '409 POST /api/v1/app-version/releases code=APP_RELEASE_BUILD_EXISTS platform=desktop ' +
        'build=10 version=- device=pc-1 company=c-1 user=tester1',
    );
    expect(sink.error).not.toHaveBeenCalled();
  });

  it('logs a 5xx as an error, an old build with dashes', () => {
    const { sink, response } = run({});
    response.statusCode = 500;
    response.emit('finish');
    expect(sink.error).toHaveBeenCalledWith(
      '500 POST /api/v1/app-version/releases code=- platform=- build=- version=- device=- company=- user=-',
    );
  });

  it.each([200, 201, 304, 401, 404])('does not log a %p', (status) => {
    const { sink, response } = run(NEW_BUILD);
    response.statusCode = status;
    response.emit('finish');
    expect(sink.warn).not.toHaveBeenCalled();
    expect(sink.error).not.toHaveBeenCalled();
  });

  it('quotes a value with a space so the line stays key=value', () => {
    const { sink, response } = run({ ...NEW_BUILD, 'x-app-version': '1.2 beta' });
    response.statusCode = 422;
    response.emit('finish');
    expect(sink.warn.mock.calls[0][0]).toContain('version="1.2 beta"');
  });

  it('errorCodesOf reads errors[].code, unique, at most five', () => {
    expect(errorCodesOf(null)).toEqual([]);
    expect(errorCodesOf({ errors: 'x' })).toEqual([]);
    expect(
      errorCodesOf({
        errors: [
          { code: 'A' },
          { code: 'A' },
          {},
          { code: 'B' },
          ...'CDEFG'.split('').map((code) => ({ code })),
        ],
      }),
    ).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});
