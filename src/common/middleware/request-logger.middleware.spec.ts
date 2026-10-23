import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { RequestLoggerMiddleware } from './request-logger.middleware';

describe('RequestLoggerMiddleware', () => {
  let log: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => log.mockRestore());

  const start = () => {
    const response = Object.assign(new EventEmitter(), { statusCode: 201 });
    const next = jest.fn();
    new RequestLoggerMiddleware().use(
      { method: 'POST', originalUrl: '/api/v1/bills/create?x=1' } as Request,
      response as unknown as Response,
      next,
    );
    return { response, next };
  };

  it('calls next at once and logs nothing until the response finishes', () => {
    const { next } = start();

    expect(next).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
  });

  it('logs method, full url, status and duration on finish', () => {
    const { response } = start();

    response.emit('finish');

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatch(/^POST \/api\/v1\/bills\/create\?x=1 201 - \d+\.\dms$/);
  });

  it('reads the status at finish, not at start', () => {
    const { response } = start();

    response.statusCode = 500;
    response.emit('finish');

    expect(log.mock.calls[0][0]).toContain(' 500 - ');
  });
});
