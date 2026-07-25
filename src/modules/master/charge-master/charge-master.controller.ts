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
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { ChargeMasterExceptionFilter } from './charge-master-exception.filter';
import {
  ChargeMasterErrorResponseDto,
  ChargeMasterSuccessDeleteDto,
  ChargeMasterSuccessManyDto,
  ChargeMasterSuccessSingleDto,
} from './dto/charge-master-response.dto';
import { GetChargeMasterQueryDto } from './dto/get-charge-master-query.dto';
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
  @ApiOperation({
    summary: 'Get charge by id, or every active charge for a module',
    description:
      'Send exactly one of `chgId` (returns a single charge) or `chgModule` (returns an array). ' +
      'A module lookup also picks up `B` (both) charges: P → P + B, S → S + B, B → B.',
  })
  @ApiExtraModels(ChargeMasterSuccessSingleDto, ChargeMasterSuccessManyDto)
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(ChargeMasterSuccessSingleDto) },
        { $ref: getSchemaPath(ChargeMasterSuccessManyDto) },
      ],
    },
  })
  @ApiBadRequestResponse({ type: ChargeMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: ChargeMasterErrorResponseDto })
  async get(
    @Query() getChargeMasterQueryDto: GetChargeMasterQueryDto,
  ): Promise<ChargeMasterSuccessResponse<ChargeMasterPayload | ChargeMasterPayload[]>> {
    const data = await this.chargeMasterService.get(getChargeMasterQueryDto);
    return {
      success: true,
      message: Array.isArray(data) ? 'Charges fetched successfully' : 'Charge fetched successfully',
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