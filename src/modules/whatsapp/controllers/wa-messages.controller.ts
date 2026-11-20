import { CacheTTL } from '@nestjs/cache-manager';
import { Body, Controller, Post, UseFilters, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { API_VERSION } from 'src/common/constants/api-version';
import { WaRetryDto, WaSendDto } from '../dto/wa.dto';
import { WaExceptionFilter } from '../wa-exception.filter';
import { WaMessagesService } from '../wa-messages.service';

const ok = <T>(message: string, data: T) => ({ success: true as const, message, data });

/**
 * Plan §5.3 "Documents", scope cut 17/11: the Sales Order confirmation sent by
 * hand, and a retry from the log. The log is grid 222 (/configured-grid-sql/run).
 */
@ApiTags('WhatsApp')
@ApiBearerAuth('access-token')
@CacheTTL(1)
@Controller('whatsapp')
@UseFilters(WaExceptionFilter)
export class WaMessagesController {
  constructor(private readonly messages: WaMessagesService) {}

  @Post('messages/send')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Send a confirmed Sales Order by hand (Print on menu 11), synchronously → { wmlId, accYear, status, phone, phoneSource, ' +
      'templateName, lang, langNote, errorCode, errorText }. SKIPPED / FAILED rows answer 200 with their code; 403 WA_RIGHT_PRINT; ' +
      '404 WA_DOC_NOT_FOUND; 409 WA_DOC_NOT_POSTED / WA_DOC_CANCELLED / WA_NOT_CONNECTED / WA_NOT_ACTIVATED / WA_OPTED_OUT / ' +
      'WA_SITE_OFFLINE; 400 WA_BAD_NUMBER.',
  })
  async send(@Body() dto: WaSendDto) {
    return ok('WhatsApp send done', await this.messages.send(dto));
  }

  @Post('messages/retry')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'A new try of a logged message (309 Post): the order as it now stands (a popup-typed number goes first again), or the ' +
      'test again → as /messages/send. Judged on the LATEST try of the chain: 409 WA_RETRY_NOT_ALLOWED while it is SENDING; ' +
      '409 WA_ALREADY_DELIVERED (extra status, latestWmlId, latestAccYear) when it is DELIVERED / READ unless confirmResend; ' +
      '400 VALIDATION_IS_IN for a kind this build does not send; 404 WA_DOC_NOT_FOUND. status SENDING in the answer = ' +
      'the relay has not confirmed yet (RELAY_SEND_UNCONFIRMED): the WhatsApp Log settles it.',
  })
  async retry(@Body() dto: WaRetryDto) {
    return ok('WhatsApp message sent again', await this.messages.retry(dto));
  }
}
