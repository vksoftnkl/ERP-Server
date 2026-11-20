import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WaPostHook, type WaPostBlock, type WaPostEvent } from './hook/wa-post-hook';
import { WaSendService } from './wa-send.service';
import { WaSettingsService } from './wa-settings.service';
import { WaStore } from './wa-store.service';

/**
 * F08–F10 — the ON_POST send, registered on WaPostHook at boot.
 *
 * Only for a voucher type in the posting company's whatsapp.on_post_types
 * (review S7: per company, not on the shared voucher type), unless the post
 * body says otherwise (waOnPost false = not this one; true = send even with the
 * tick off). Steps 1–6 run now (a few reads and one log row) so the post's
 * answer can say SENDING / SKIPPED / NOT_CONNECTED; the PDF, the relay and the
 * status step run after the answer has gone. Nothing here can throw into the
 * post: WaPostHook.fire catches.
 */
@Injectable()
export class WaAfterPostService implements OnModuleInit {
  private readonly logger = new Logger(WaAfterPostService.name);

  constructor(
    private readonly hook: WaPostHook,
    private readonly store: WaStore,
    private readonly sends: WaSendService,
    private readonly settings: WaSettingsService,
  ) {}

  onModuleInit(): void {
    this.hook.register((event) => this.onPost(event));
  }

  async onPost(event: WaPostEvent): Promise<WaPostBlock | null> {
    if (event.waOnPost === false) return null;
    if (event.waOnPost !== true && !(await this.ticked(event.companyId, event.vchrTypeId))) return null;
    const actor = await this.store.actor();
    const prepared = await this.sends.prepareDocument({
      companyId: event.companyId,
      docType: event.docType,
      docId: event.docId,
      docAccYear: event.accYear,
      trigger: 'ON_POST',
      actor,
    });
    if ('notConnected' in prepared) {
      return { wmlId: null, accYear: null, status: 'NOT_CONNECTED', fallbackClickToChat: prepared.fallbackClickToChat };
    }
    if (prepared.status === 'SENDING') {
      setImmediate(() => {
        this.sends.deliver(prepared).catch((e) => this.logger.error(`on-post send ${prepared.wmlId}: ${String(e)}`));
      });
    }
    return {
      wmlId: prepared.wmlId,
      accYear: prepared.accYear,
      status: prepared.status === 'SENDING' ? 'SENDING' : prepared.status === 'FAILED' ? 'FAILED' : 'SKIPPED',
      errorCode: prepared.errorCode,
    };
  }

  /** Review S7 — the company's whatsapp.on_post_types lists this voucher type (a missing setting is []). */
  private async ticked(companyId: string, vchrTypeId: number | null): Promise<boolean> {
    if (vchrTypeId === null) return false;
    return (await this.settings.onPostSetting(companyId)).ids.includes(vchrTypeId);
  }
}
