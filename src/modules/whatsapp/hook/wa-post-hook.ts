import { Global, Injectable, Logger, Module } from '@nestjs/common';

/**
 * WhatsApp decision 17 — "WhatsApp on Post" runs on the server, AFTER the
 * post's transaction has committed, for every client (Qt, mobile).
 *
 * The post paths call `WaPostHook.fire(...)` once their transaction returned
 * (today the Sales Order post; bills and receipts later). This tiny global module is all they depend
 * on: the WhatsApp module registers the handler at boot, so the sales and
 * accounts modules never import the WhatsApp module (no cycle through the
 * print engine), and with no handler registered `fire` answers null.
 *
 * `fire` NEVER throws and never rolls anything back: a failure is logged and
 * the post's answer simply carries no `whatsapp` block.
 */
export interface WaPostEvent {
  /** Scope cut 17/11: the Sales Order confirmation only; bills and receipts come later. */
  docType: 'SALES_ORDER';
  docId: string;
  accYear: string;
  companyId: string;
  branchId: string;
  /** The document's voucher type (4 Sales Order), looked up in the company's whatsapp.on_post_types. */
  vchrTypeId: number | null;
  /** The post body's waOnPost: absent = the company's on-post setting; false = not this one; true = send. */
  waOnPost?: boolean | null;
}

/** The post response's `whatsapp` block (§5.3). Present only when the company setting or the flag asked for a send. */
export interface WaPostBlock {
  wmlId: string | null;
  accYear: string | null;
  status: 'SENDING' | 'SKIPPED' | 'FAILED' | 'NOT_CONNECTED';
  errorCode?: string | null;
  fallbackClickToChat?: boolean;
}

export type WaPostHandler = (event: WaPostEvent) => Promise<WaPostBlock | null>;

@Injectable()
export class WaPostHook {
  private readonly logger = new Logger(WaPostHook.name);
  private handler: WaPostHandler | null = null;

  register(handler: WaPostHandler): void {
    this.handler = handler;
  }

  async fire(event: WaPostEvent): Promise<WaPostBlock | null> {
    if (!this.handler) return null;
    try {
      return await this.handler(event);
    } catch (error) {
      this.logger.error(
        `WhatsApp on post for ${event.docType} ${event.docId} failed (the post stands): ${
          error instanceof Error ? error.stack : String(error)
        }`,
      );
      return null;
    }
  }
}

@Global()
@Module({ providers: [WaPostHook], exports: [WaPostHook] })
export class WaPostHookModule {}
