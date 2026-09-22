import { Injectable, Logger } from '@nestjs/common';
import { SALES_ERROR_CODES } from './types/posting.types';
import { throwSalesLocked } from './sales.errors';

/**
 * The seam to the GST module (`../gst/HANDOVER_endpoints.md`).
 *
 * That module is not in this repository yet. Everything a sales verb needs
 * from it goes through HERE so the day it lands there is one file to wire, and
 * until then every call is HONEST about what it did: a cancel that needs the
 * IRN cancelled first is refused with `GST_IRN_CANCEL_FAILED`, never faked by
 * flipping `gde_status` on a portal that was never told.
 */
export interface IrnCancelRequest {
  gdrId: string;
  accYear: string;
  companyId: string;
  reason: string;
}

@Injectable()
export class GstGatewayService {
  private readonly logger = new Logger(GstGatewayService.name);

  /** True once a real gateway is wired; the sales verbs branch on it. */
  readonly configured = false;

  cancelIrn(req: IrnCancelRequest): Promise<{ cancelledOn: string }> {
    this.logger.warn(
      `IRN cancel requested for register ${req.gdrId} but no GST gateway is configured`,
    );
    throwSalesLocked(
      'This document has a live IRN and the e-invoice service is not configured to cancel it — cancel the IRN at the portal first',
      SALES_ERROR_CODES.IRN_CANCEL_FAILED,
      'posting.irn',
    );
  }

  cancelEwb(req: IrnCancelRequest): Promise<{ cancelledOn: string }> {
    this.logger.warn(
      `EWB cancel requested for register ${req.gdrId} but no GST gateway is configured`,
    );
    throwSalesLocked(
      'This document has a live e-way bill and the e-way bill service is not configured to cancel it — cancel it at the portal first',
      SALES_ERROR_CODES.EWB_WINDOW_PASSED,
      'posting.ewb',
    );
  }

  /**
   * After a commit: what `/bills/post` would enqueue for the GSP. A no-op that
   * logs until the gateway exists — the register row already carries the two
   * applicability flags, so nothing is lost by not firing.
   */
  enqueueAfterPost(doc: { gdrId: string | null; einvoice: boolean; ewaybill: boolean }): void {
    if (!doc.gdrId || (!doc.einvoice && !doc.ewaybill)) {
      return;
    }
    this.logger.log(
      `GST generation pending for register ${doc.gdrId} (e-invoice ${doc.einvoice}, e-way bill ${doc.ewaybill}); no gateway configured`,
    );
  }
}
