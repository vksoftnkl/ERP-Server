import { of } from 'rxjs';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../../modules/auth/token.service';
import { DataChangeService } from './data-change.service';
import { DataChangesController } from './data-changes.controller';

type StreamRequest = Request & { user?: AccessTokenPayload };

describe('DataChangesController', () => {
  const stream = of({ type: 'ready', data: {} });
  const streamFor = jest.fn(() => stream);
  const controller = new DataChangesController({ streamFor } as unknown as DataChangeService);

  beforeEach(() => streamFor.mockClear());

  it("hands the service the caller's auth session so its own writes are filtered out", () => {
    const result = controller.stream({ user: { sid: 'sid-a' } } as unknown as StreamRequest);

    expect(streamFor).toHaveBeenCalledWith('sid-a');
    expect(result).toBe(stream);
  });

  it('passes null when the token carries no session id', () => {
    controller.stream({ user: {} } as unknown as StreamRequest);

    expect(streamFor).toHaveBeenCalledWith(null);
  });

  it('passes null when the request has no user', () => {
    controller.stream({} as StreamRequest);

    expect(streamFor).toHaveBeenCalledWith(null);
  });
});
