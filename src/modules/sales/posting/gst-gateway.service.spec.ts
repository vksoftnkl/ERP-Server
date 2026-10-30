import { HttpException, Logger } from '@nestjs/common';
import { GstGatewayService } from './gst-gateway.service';
import { SALES_ERROR_CODES } from './types/posting.types';

const REQUEST = {
  gdrId: '019c6f6c-be87-7a11-8905-36092c46b101',
  accYear: '2026-2027',
  companyId: 'company-1',
  reason: 'Wrong buyer',
};

/** The status and body of the HttpException a call threw. */
function thrownBy(call: () => unknown): { status: number; body: unknown } {
  try {
    call();
  } catch (error) {
    if (error instanceof HttpException) {
      return { status: error.getStatus(), body: error.getResponse() };
    }
    throw error;
  }
  throw new Error('expected the call to throw');
}

describe('GstGatewayService — no gateway wired yet', () => {
  let service: GstGatewayService;
  let log: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    service = new GstGatewayService();
  });

  afterEach(() => jest.restoreAllMocks());

  it('says it is not configured', () => {
    expect(service.configured).toBe(false);
  });

  it('refuses an IRN cancel honestly instead of faking it', () => {
    expect(thrownBy(() => service.cancelIrn(REQUEST))).toMatchObject({
      status: 409,
      body: { errors: [{ field: 'posting.irn', code: SALES_ERROR_CODES.IRN_CANCEL_FAILED }] },
    });
  });

  it('refuses an e-way bill cancel with a 409 on posting.ewb', () => {
    expect(thrownBy(() => service.cancelEwb(REQUEST))).toMatchObject({
      status: 409,
      body: { errors: [{ field: 'posting.ewb' }] },
    });
  });

  it('logs a pending generation only for a register that needs one', () => {
    service.enqueueAfterPost({ gdrId: null, einvoice: true, ewaybill: true });
    service.enqueueAfterPost({ gdrId: REQUEST.gdrId, einvoice: false, ewaybill: false });
    expect(log).not.toHaveBeenCalled();

    service.enqueueAfterPost({ gdrId: REQUEST.gdrId, einvoice: true, ewaybill: false });
    expect(log).toHaveBeenCalledTimes(1);
  });
});
