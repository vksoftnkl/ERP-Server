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
import { API_VERSION } from '../../../common/constants/api-version';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { PrintTemplateAssignmentExceptionFilter } from './print-template-assignment-exception.filter';
import { PrintTemplateAssignmentService } from './print-template-assignment.service';
import { SavePrintTemplateAssignmentDto } from './dto/save-print-template-assignment.dto';
import { ListPrintTemplateAssignmentQueryDto } from './dto/list-print-template-assignment-query.dto';
import { ResolvePrintTemplateAssignmentQueryDto } from './dto/resolve-print-template-assignment-query.dto';
import {
  PrintTemplateAssignmentErrorResponseDto,
  PrintTemplateAssignmentSuccessCreateDto,
  PrintTemplateAssignmentSuccessDeleteDto,
  PrintTemplateAssignmentSuccessListDto,
  PrintTemplateAssignmentSuccessResolveDto,
  PrintTemplateAssignmentSuccessSingleDto,
} from './dto/print-template-assignment-response.dto';
import {
  PrintTemplateAssignmentListResult,
  PrintTemplateAssignmentPayload,
  PrintTemplateAssignmentResolution,
  PrintTemplateAssignmentSuccessResponse,
} from './types/print-template-assignment-api.types';

@ApiTags('Print Template Assignments')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('print-template-assignments')
@UseFilters(PrintTemplateAssignmentExceptionFilter)
export class PrintTemplateAssignmentController {
  constructor(
    private readonly printTemplateAssignmentService: PrintTemplateAssignmentService,
    private readonly requestContextService: RequestContextService,
  ) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update a print template assignment (by ptaId presence)',
    description:
      'One row IS one choice: there is no is_default flag, so changing the design for a scope is an update of this one row. Scope is a ladder — counter, branch, company, every company — and ptaCompanyId must be PRESENT on create: send null deliberately for the every-company rung, which only a shipped design may occupy.',
  })
  @ApiCreatedResponse({ type: PrintTemplateAssignmentSuccessCreateDto })
  @ApiOkResponse({ type: PrintTemplateAssignmentSuccessSingleDto })
  @ApiBadRequestResponse({ type: PrintTemplateAssignmentErrorResponseDto })
  @ApiConflictResponse({ type: PrintTemplateAssignmentErrorResponseDto })
  @ApiNotFoundResponse({ type: PrintTemplateAssignmentErrorResponseDto })
  async create(
    @Body() dto: SavePrintTemplateAssignmentDto,
  ): Promise<PrintTemplateAssignmentSuccessResponse<PrintTemplateAssignmentPayload>> {
    if (dto.ptaId) {
      const data = await this.printTemplateAssignmentService.save(dto);
      return { success: true, message: 'Print template assignment updated successfully', data };
    }

    const userId = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    const data = await this.printTemplateAssignmentService.createAssignment(dto, userId);
    return { success: true, message: 'Print template assignment created successfully', data };
  }

  @Get('list')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'List print template assignments, narrowest scope first',
    description:
      'Pair ptaCompanyId with includeGlobal to see what a company inherits where it has said nothing, or globalOnly for the every-company rows alone.',
  })
  @ApiOkResponse({ type: PrintTemplateAssignmentSuccessListDto })
  @ApiBadRequestResponse({ type: PrintTemplateAssignmentErrorResponseDto })
  async list(
    @Query() queryDto: ListPrintTemplateAssignmentQueryDto,
  ): Promise<PrintTemplateAssignmentSuccessResponse<PrintTemplateAssignmentListResult>> {
    const data = await this.printTemplateAssignmentService.list(queryDto);
    return { success: true, message: 'Print template assignments fetched successfully', data };
  }

  @Get('resolve')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Resolve which design wins for a counter',
    description:
      'Narrowest wins: counter, then branch, then company, then the every-company default. Returns the template, its published revision, the printer and the copy count — the assignment overrides the purpose, NULL means use it. printerSource says whether the printer is a registered profile (paper and codepage known and assertable), a bare queue name (neither known), or the counter default.',
  })
  @ApiOkResponse({ type: PrintTemplateAssignmentSuccessResolveDto })
  @ApiBadRequestResponse({ type: PrintTemplateAssignmentErrorResponseDto })
  @ApiNotFoundResponse({ type: PrintTemplateAssignmentErrorResponseDto })
  async resolve(
    @Query() queryDto: ResolvePrintTemplateAssignmentQueryDto,
  ): Promise<PrintTemplateAssignmentSuccessResponse<PrintTemplateAssignmentResolution>> {
    const data = await this.printTemplateAssignmentService.resolve(queryDto);
    return { success: true, message: 'Print template resolved successfully', data };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get a print template assignment by id' })
  @ApiQuery({ name: 'ptaId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: PrintTemplateAssignmentSuccessSingleDto })
  @ApiBadRequestResponse({ type: PrintTemplateAssignmentErrorResponseDto })
  @ApiNotFoundResponse({ type: PrintTemplateAssignmentErrorResponseDto })
  async getById(
    @Query('ptaId', new ParseUUIDPipe({ version: '7' })) ptaId: string,
  ): Promise<PrintTemplateAssignmentSuccessResponse<PrintTemplateAssignmentPayload>> {
    const data = await this.printTemplateAssignmentService.getById(ptaId);
    return { success: true, message: 'Print template assignment fetched successfully', data };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft delete a print template assignment by id',
    description:
      'Removing the row removes the choice for that scope; the resolver then falls back to the next rung up — branch, company, and finally the every-company default.',
  })
  @ApiQuery({ name: 'ptaId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: PrintTemplateAssignmentSuccessDeleteDto })
  @ApiBadRequestResponse({ type: PrintTemplateAssignmentErrorResponseDto })
  @ApiNotFoundResponse({ type: PrintTemplateAssignmentErrorResponseDto })
  async remove(
    @Query('ptaId', new ParseUUIDPipe({ version: '7' })) ptaId: string,
  ): Promise<PrintTemplateAssignmentSuccessResponse<{ ptaId: string; deleted: true }>> {
    const data = await this.printTemplateAssignmentService.softDelete(ptaId);
    return { success: true, message: 'Print template assignment deleted successfully', data };
  }
}
