import { CacheTTL } from '@nestjs/cache-manager';
import { Body, Controller, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { API_VERSION } from 'src/common/constants/api-version';
import { SaveVoucherTypeDto, ValidateVoucherTypeDto } from './dto/save-voucher-type.dto';
import {
  PrintDesignCloneDto,
  VoucherTypeGetQueryDto,
  VoucherTypeRefDto,
  VoucherTypeTreeQueryDto,
} from './dto/voucher-type-query.dto';
import { VoucherTypesExceptionFilter } from './voucher-types-exception.filter';
import { VoucherTypesService } from './voucher-types.service';

/**
 * Voucher Types master, menu 303 under Settings › Configuration
 * (Shared/Prathap/accounts/plan-voucher-types-2026-11-14.md §7.1). Rights on menu
 * 303 (VT_RIGHT_*). Writes are online only (VT_OFFLINE). Per-company answers:
 * never cached (CacheTTL 1 as the other masters).
 */
@ApiTags('Voucher Types')
@ApiBearerAuth('access-token')
@CacheTTL(1)
@Controller('voucher-types')
@UseFilters(VoucherTypesExceptionFilter)
export class VoucherTypesController {
  constructor(private readonly service: VoucherTypesService) {}

  @Get('tree')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Every base type and this company’s child types, flat (vchrParentId), with Kind and numberedBy.',
  })
  async tree(@Query() q: VoucherTypeTreeQueryDto) {
    const data = await this.service.tree(q.companyId, q.includeInactive ?? false);
    return { success: true, message: `${data.nodes.length} voucher type(s)`, data };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'One voucher type: row, inherited accounting, counters this year, print designs, preview.',
  })
  async get(@Query() q: VoucherTypeGetQueryDto) {
    return { success: true, message: 'Voucher type fetched', data: await this.service.get(q) };
  }

  @Post('validate')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'The save body judged without writing: ok, errors[] (worded), warnings[], preview (A11).',
  })
  async validate(@Body() dto: ValidateVoucherTypeDto) {
    const data = await this.service.validate(dto);
    return {
      success: true,
      message: data.ok ? 'Voucher type can be saved' : 'Voucher type cannot be saved',
      data,
    };
  }

  @Post('save')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Create a child type (no vchrTypeId) or change a type. Answers the /get payload plus warnings[].',
  })
  async save(@Body() dto: SaveVoucherTypeDto) {
    const data = await this.service.save(dto);
    return { success: true, message: `Voucher type ${data.type.vchrTypeName} saved`, data };
  }

  @Post('inactivate')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Make a child type inactive (C4: a used type cannot be deleted).' })
  async inactivate(@Body() dto: VoucherTypeRefDto) {
    const { name, ...data } = await this.service.inactivate(dto);
    return { success: true, message: `Voucher type ${name} made inactive`, data };
  }

  @Post('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Delete an unused child type (VT_IN_USE when a bill, counter or voucher uses it).',
  })
  async remove(@Body() dto: VoucherTypeRefDto) {
    const { name, ...data } = await this.service.remove(dto);
    return { success: true, message: `Voucher type ${name} deleted`, data };
  }

  @Post('print-design-clone')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Alt+C: copy a print design (purpose) as this company’s own, same kind / copies / labels, no layout.',
  })
  async clonePrintDesign(@Body() dto: PrintDesignCloneDto) {
    const data = await this.service.clonePrintDesign(dto);
    return { success: true, message: `Print design ${data.ppoCode} made`, data };
  }
}
