import { CacheTTL } from '@nestjs/cache-manager';
import { Body, Controller, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { API_VERSION } from '../../../common/constants/api-version';
import { DeliveryExceptionFilter } from './delivery-exception.filter';
import { DeliveryNoteService } from './delivery-note.service';
import {
  CancelDeliveryNoteDto,
  DeliveryLotsQueryDto,
  DeliveryNoteGetQueryDto,
  DeliveryNoteKeysDto,
  DeliveryScanQueryDto,
  GoodsBackDto,
  OpenLinesDto,
  PostDeliveryNoteDto,
  SaveDeliveryNoteDto,
  ValidateDeliveryNoteDto,
} from './dto/delivery-note.dto';

const ok = <T>(message: string, data: T) => ({ success: true as const, message, data });

/**
 * Delivery tracking plan §8.1 — `/api/v1/delivery-notes` (menu 305): the
 * Delivery Note / gate pass. Every route checks menu 305's user_menus flag
 * (403 DN_RIGHT_*). The list is grid 216 — there is no /list route.
 */
@ApiTags('Delivery Notes')
@ApiBearerAuth('access-token')
@CacheTTL(1)
@Controller('delivery-notes')
@UseFilters(DeliveryExceptionFilter)
export class DeliveryNotesController {
  constructor(private readonly service: DeliveryNoteService) {}

  @Post('save')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Create (menu 305 CREATE) or update (EDIT) a DRAFT note. A draft holds nothing (Q12). Numbered per device at the first ' +
      'save (DN/<year>/<device>/00001). Answers the get payload. 409 DN_NOT_DRAFT / DN_REVISION_STALE / DN_GODOWN_LOCKED; ' +
      '422 DN_GODOWN_REQUIRED / DN_GODOWN_NOT_IN_BRANCH / DN_QTY_NEGATIVE / DN_LOT_INVALID; 409 DN_BILL_*; 403 DN_GODOWN_RIGHT.',
  })
  async save(@Body() dto: SaveDeliveryNoteDto) {
    return ok(dto.sdnId ? 'Delivery note saved' : 'Delivery note created', await this.service.save(dto));
  }

  @Post('validate')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Dry-run the post over the body (CREATE or EDIT). Writes nothing. { ok, errors[], warnings[], infos[], totals, load, rights } — ' +
      'each finding { code, severity, field, lineNo, params, message, user }.',
  })
  async validate(@Body() dto: ValidateDeliveryNoteDto) {
    return ok('Delivery note validated', await this.service.validate(dto));
  }

  @Post('post')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Save and post in one transaction (menu 305 POST; OVERRIDE for other-godown lines): one GIVEN event per line, lot / godown ' +
      'corrections through the stock engine, the bills\' status recomputed. Answers the get payload + postedBills[] + corrections[]. ' +
      '409 DN_QTY_OVER_PENDING / DN_WARN_NOT_CONFIRMED / DN_GODOWN_FROZEN / DN_STOCK_NEGATIVE; 422 DN_NO_LINES / DN_*_REQUIRED.',
  })
  async post(@Body() dto: PostDeliveryNoteDto) {
    return ok('Delivery note posted', await this.service.post(dto));
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'One note: { note, bills[], lines[], elsewhere[], totals, load, rights } (menu 305 VIEW)' })
  async get(@Query() q: DeliveryNoteGetQueryDto) {
    return ok('Delivery note fetched', await this.service.get(q));
  }

  @Post('cancel')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Cancel a POSTED note (CANCEL): CANCEL events for what is still out, every correction voucher cancelled, bills recomputed. ' +
      '422 DN_CANCEL_REASON_REQUIRED; 409 DN_ALREADY_CANCELLED / DN_GOODS_BACK_NOT_POSTED (a draft is deleted).',
  })
  async cancel(@Body() dto: CancelDeliveryNoteDto) {
    return ok('Delivery note cancelled', await this.service.cancel(dto));
  }

  @Post('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft-delete a DRAFT note (DELETE). 409 DN_NOT_DRAFT on a posted one.' })
  async remove(@Body() dto: DeliveryNoteKeysDto) {
    return ok('Draft delivery note deleted', await this.service.delete(dto));
  }

  @Post('goods-back')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Goods refused at the door (POST right): GOODS_BACK events, the line corrections undone for the qty, bills recomputed; the ' +
      'note stays POSTED. A re-sent request whose sdeId exists writes nothing (replayed: true). 409 DN_GOODS_BACK_OVER / ' +
      'DN_GOODS_BACK_NOT_POSTED / DN_ALREADY_CANCELLED; 422 DN_GOODS_BACK_REASON_REQUIRED.',
  })
  async goodsBack(@Body() dto: GoodsBackDto) {
    return ok('Goods back recorded', await this.service.goodsBack(dto));
  }

  @Get('scan')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'A scanned / typed code in one godown (VIEW): NXB1- bill QR, NXD1- gate-pass QR, or a bill no. { kind, bill, bills[], lines[], ' +
      'elsewhere[], note } — bills[] in the get payload\'s shape ([] for a NOTE); each line carries unitKg. ' +
      '404 DN_SCAN_UNKNOWN; 409 DN_SCAN_NO_OPEN_HERE / DELIVERY_NOTHING_OPEN.',
  })
  async scan(@Query() q: DeliveryScanQueryDto) {
    return ok('Scan resolved', await this.service.scan(q));
  }

  @Post('open-lines')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      "The bills' open lines in one godown (F4 Add; F8 from 304): { bills[], lines[], elsewhere[] } (VIEW). bills[] has the get " +
      "payload's shape, linesHere / linesElsewhere counted against godownId; each line carries unitKg (kg of one package).",
  })
  async openLines(@Body() dto: OpenLinesDto) {
    return ok('Open lines fetched', await this.service.openLines(dto));
  }

  @Get('lots')
  @Version(API_VERSION)
  @ApiOperation({
    summary: "The Lot cell's F2 list: lots[] { lotId, lotNo, expiryDate, owned, notDelivered, physical } in base units (VIEW)",
  })
  async lots(@Query() q: DeliveryLotsQueryDto) {
    return ok('Lots fetched', await this.service.lots(q));
  }
}
