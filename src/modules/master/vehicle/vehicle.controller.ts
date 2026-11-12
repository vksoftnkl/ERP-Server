import { CacheTTL } from '@nestjs/cache-manager';
import { Body, Controller, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { API_VERSION } from 'src/common/constants/api-version';
import { SaveVehicleDto } from './dto/save-vehicle.dto';
import { VehicleRefDto } from './dto/vehicle-ref.dto';
import { VehicleExceptionFilter } from './vehicle-exception.filter';
import { VehicleService } from './vehicle.service';

/** Vehicle Master, menu 125 (plan-vehicle-master-2026-11-11 §5.1). The list is grid 206. */
@ApiTags('Vehicles')
@ApiBearerAuth('access-token')
@CacheTTL(1)
@Controller('vehicles')
@UseFilters(VehicleExceptionFilter)
export class VehicleController {
  constructor(private readonly service: VehicleService) {}

  @Post('save')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create (no vehId) or update a vehicle of the login company.' })
  async save(@Body() dto: SaveVehicleDto) {
    const data = await this.service.save(dto);
    return { success: true, message: `Vehicle ${data.vehicleNo} saved`, data };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'One vehicle with its transporter, driver and home branch names.' })
  async get(@Query() q: VehicleRefDto) {
    return { success: true, message: 'Vehicle fetched', data: await this.service.getById(q.vehId) };
  }

  @Post('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete a vehicle; saved documents keep its number.' })
  async remove(@Body() dto: VehicleRefDto) {
    const { vehicleNo, ...data } = await this.service.softDelete(dto.vehId);
    return { success: true, message: `Vehicle ${vehicleNo} deleted`, data };
  }
}
