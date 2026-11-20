import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AppSettingsModule } from '../settings/appSettings/app-settings.module';
import { PrintRenderModule } from '../settings/print-render/print-render.module';
import { WaConnectionController } from './controllers/wa-connection.controller';
import { WaMessagesController } from './controllers/wa-messages.controller';
import { WaAfterPostService } from './wa-after-post.service';
import { WaConnectionService } from './wa-connection.service';
import { WaCryptoService } from './wa-crypto.service';
import { WaEventsService } from './wa-events.service';
import { WaExceptionFilter } from './wa-exception.filter';
import { WaMessagesService } from './wa-messages.service';
import { WaPollerService } from './wa-poller.service';
import { WaRelayClient } from './wa-relay.client';
import { WaSendService } from './wa-send.service';
import { WaSettingsService } from './wa-settings.service';
import { WaStore } from './wa-store.service';

/**
 * WhatsApp option B, the ERP side (plan Shared/Prathap/whatsapp/whatsapp-plan-v1-2026-11-17.md
 * §5), SCOPE CUT 17/11 (user): ONE transaction now — the Sales Order
 * confirmation — plus the plumbing (activate / connect / test, the poller,
 * the message log, retry). Bills, receipts, payment reminders (308), the
 * party statement and the customer language / opt-out edits come later.
 * See README.md.
 *
 * Prisma, the request context and ConfigService are global; WaPostHookModule
 * (the hook the post paths call) is global too and imported once in AppModule.
 */
@Module({
  imports: [AuditLogModule, AppSettingsModule, PrintRenderModule],
  controllers: [WaConnectionController, WaMessagesController],
  providers: [
    WaStore,
    WaCryptoService,
    WaRelayClient,
    WaSettingsService,
    WaSendService,
    WaEventsService,
    WaConnectionService,
    WaMessagesService,
    WaAfterPostService,
    WaPollerService,
    WaExceptionFilter,
  ],
})
export class WhatsappModule {}
