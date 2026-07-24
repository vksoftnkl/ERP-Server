import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Delete,
  Get,
  ParseUUIDPipe,
  Post,
  Query,
  UseFilters,
  Version,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { ChargeMasterExceptionFilter } from './charge-master-exception.filter';
import {
  ChargeMasterErrorResponseDto,
  ChargeMasterSuccessDeleteDto,
  ChargeMasterSuccessSingleDto,
} from './dto/charge-master-response.dto';
import { SaveChargeMasterDto } from './dto/save-charge-master.dto';
import { ChargeMasterService } from './charge-master.service';
import {
  ChargeMasterDeleteResult,
  ChargeMasterPayload,
  ChargeMasterSuccessResponse,
} from './types/charge-master-api.types';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('Charge Master')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('charges')
@UseFilters(ChargeMasterExceptionFilter)
export class ChargeMasterController {
  constructor(private readonly chargeMasterService: ChargeMasterService) {}
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update charge (by chgId presence)' })
  @ApiCreatedResponse({ type: ChargeMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: ChargeMasterErrorResponseDto })
  @ApiConflictResponse({ type: ChargeMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: ChargeMasterErrorResponseDto })
  async save(
    @Body() saveChargeMasterDto: SaveChargeMasterDto,
  ): Promise<ChargeMasterSuccessResponse<ChargeMasterPayload>> {
    const data = await this.chargeMasterService.save(saveChargeMasterDto);
    return {
      success: true,
      message: saveChargeMasterDto.chgId
        ? 'Charge updated successfully'
        : 'Charge created successfully',
      data,
    };
  }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get charge by id' })
  @ApiQuery({ name: 'chgId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ChargeMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: ChargeMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: ChargeMasterErrorResponseDto })
  async getById(
    @Query('chgId', new ParseUUIDPipe()) chgId: string,
  ): Promise<ChargeMasterSuccessResponse<ChargeMasterPayload>> {
    const data = await this.chargeMasterService.getById(chgId);
    return {
      success: true,
      message: 'Charge fetched successfully',
      data,
    };
  }
  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete charge by id' })
  @ApiQuery({ name: 'chgId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ChargeMasterSuccessDeleteDto })
  @ApiBadRequestResponse({ type: ChargeMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: ChargeMasterErrorResponseDto })
  async remove(
    @Query('chgId', new ParseUUIDPipe()) chgId: string,
  ): Promise<ChargeMasterSuccessResponse<ChargeMasterDeleteResult>> {
    const data = await this.chargeMasterService.softDelete(chgId);
    return {
      success: true,
      message: 'Charge deleted successfully',
      data,
    };
  }
}