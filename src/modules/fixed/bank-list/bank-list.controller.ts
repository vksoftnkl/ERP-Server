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
import { BankListExceptionFilter } from './bank-list-exception.filter';
import {
  BankListErrorResponseDto,
  BankListSuccessDeleteDto,
  BankListSuccessListDto,
  BankListSuccessSingleDto,
} from './dto/bank-list-response.dto';
import { ListBankListQueryDto } from './dto/list-bank-list-query.dto';
import { SaveBankListDto } from './dto/save-bank-list.dto';
import { BankListService } from './bank-list.service';
import {
  BankListItem,
  BankListMeta,
  BankListPayload,
  BankListSuccessResponse,
} from './types/bank-list-api.types';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('Bank List')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(300)
@Controller('bank-lists')
@UseFilters(BankListExceptionFilter)
export class BankListController {
  constructor(private readonly bankListService: BankListService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update bank (by bnkId presence)' })
  @ApiCreatedResponse({ type: BankListSuccessSingleDto })
  @ApiBadRequestResponse({ type: BankListErrorResponseDto })
  @ApiConflictResponse({ type: BankListErrorResponseDto })
  @ApiNotFoundResponse({ type: BankListErrorResponseDto })
  async save(
    @Body() saveBankListDto: SaveBankListDto,
  ): Promise<BankListSuccessResponse<BankListPayload>> {
    const data = await this.bankListService.save(saveBankListDto);

    return {
      success: true,
      message: saveBankListDto.bnkId ? 'Bank updated successfully' : 'Bank created successfully',
      data,
    };
  }

  @Get('list')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'List banks with filter/search/pagination' })
  @ApiOkResponse({ type: BankListSuccessListDto })
  @ApiBadRequestResponse({ type: BankListErrorResponseDto })
  async list(
    @Query() queryDto: ListBankListQueryDto,
  ): Promise<BankListSuccessResponse<BankListItem[], BankListMeta>> {
    const result = await this.bankListService.list(queryDto);

    return {
      success: true,
      message: 'Banks fetched successfully',
      data: result.items,
      meta: result.meta,
      ...(result.styles !== undefined && { styles: result.styles }),
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get bank by id' })
  @ApiQuery({ name: 'bnkId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: BankListSuccessSingleDto })
  @ApiBadRequestResponse({ type: BankListErrorResponseDto })
  @ApiNotFoundResponse({ type: BankListErrorResponseDto })
  async getById(
    @Query('bnkId', new ParseUUIDPipe({ version: '7' })) bnkId: string,
  ): Promise<BankListSuccessResponse<BankListPayload>> {
    const data = await this.bankListService.getById(bnkId);

    return {
      success: true,
      message: 'Bank fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete bank by id' })
  @ApiQuery({ name: 'bnkId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: BankListSuccessDeleteDto })
  @ApiBadRequestResponse({ type: BankListErrorResponseDto })
  @ApiNotFoundResponse({ type: BankListErrorResponseDto })
  async remove(
    @Query('bnkId', new ParseUUIDPipe({ version: '7' })) bnkId: string,
  ): Promise<BankListSuccessResponse<{ bnkId: string; deleted: true }>> {
    const data = await this.bankListService.softDelete(bnkId);

    return {
      success: true,
      message: 'Bank deleted successfully',
      data,
    };
  }
}
