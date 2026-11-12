import { CacheTTL } from '@nestjs/cache-manager';
import { Body, Controller, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { API_VERSION } from 'src/common/constants/api-version';
import { SaveTransporterDto } from './dto/save-transporter.dto';
import { TransporterRefDto } from './dto/transporter-ref.dto';
import { TransporterExceptionFilter } from './transporter-exception.filter';
import { TransporterService } from './transporter.service';

/** Transporters, menu 149 (plan-vehicle-master-2026-11-11 §5.2). The list is grid 200. */
@ApiTags('Transporters')
@ApiBearerAuth('access-token')
@CacheTTL(1)
@Controller('transporters')
@UseFilters(TransporterExceptionFilter)
export class TransporterController {
  constructor(private readonly service: TransporterService) {}

  @Post('save')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create (no trnId; makes its own ledger under Transporters) or update a transporter (its ledger follows).' })
  async save(@Body() dto: SaveTransporterDto) {
    const data = await this.service.save(dto);
    return { success: true, message: `Transporter ${data.name} saved`, data };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'One transporter with its state, ledger and how many vehicles name it.' })
  async get(@Query() q: TransporterRefDto) {
    return { success: true, message: 'Transporter fetched', data: await this.service.getById(q.trnId) };
  }

  @Post('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete a transporter and its ledger, only at a zero balance with no cheque in hand.' })
  async remove(@Body() dto: TransporterRefDto) {
    const { name, ...data } = await this.service.softDelete(dto.trnId);
    return { success: true, message: `Transporter ${name} deleted`, data };
  }
}
