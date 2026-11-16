import { CacheTTL } from '@nestjs/cache-manager';
import { Body, Controller, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { API_VERSION } from '../../../common/constants/api-version';
import { DeliveriesService } from './deliveries.service';
import { DeliveryExceptionFilter } from './delivery-exception.filter';
import { DeliveryExceptionsQueryDto, DeliveryModeDto } from './dto/delivery-note.dto';

const ok = <T>(message: string, data: T) => ({ success: true as const, message, data });

/**
 * Delivery tracking plan §8.2 — `/api/v1/deliveries` (Pending Deliveries,
 * menu 304, and the bill). The pending lists are grids 212–218.
 */
@ApiTags('Deliveries')
@ApiBearerAuth('access-token')
@CacheTTL(1)
@Controller('deliveries')
@UseFilters(DeliveryExceptionFilter)
export class DeliveriesController {
  constructor(private readonly service: DeliveriesService) {}

  @Post('mode')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      "A posted bill's Pickup ↔ Dispatch switch (Sales Bill EDIT, 403 DELIVERY_RIGHT_MODE), with a reason and a DELIVERY_MODE " +
      'step. 409 DELIVERY_MODE_INSTANT / DELIVERY_MODE_GIVEN; 422 DELIVERY_MODE_INVALID / DELIVERY_MODE_REASON_REQUIRED.',
  })
  async mode(@Body() dto: DeliveryModeDto) {
    return ok('Delivery mode changed', await this.service.mode(dto));
  }

  @Get('exceptions')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Over-given bill lines (settled > billed, decision 46) of a branch: rows[] { billId, billAccYear, billRefno, billItemId, lineNo, ' +
      'itemName, godownName, billedQty, settledQty, overQty, lastEvent } (menu 304 VIEW, 403 DELIVERY_RIGHT_VIEW)',
  })
  async exceptions(@Query() q: DeliveryExceptionsQueryDto) {
    return ok('Delivery exceptions fetched', await this.service.exceptions(q));
  }
}
