import { CacheTTL } from '@nestjs/cache-manager';
import { Body, Controller, Delete, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { ListPrintTemplateQueryDto } from './dto/list-print-template-query.dto';
import {
  DeletePrintTemplateQueryDto,
  PrintTemplateIdQueryDto,
} from './dto/print-template-id-query.dto';
import {
  PrintTemplateErrorResponseDto,
  PrintTemplateSuccessDeleteDto,
  PrintTemplateSuccessListDto,
  PrintTemplateSuccessSingleDto,
} from './dto/print-template-response.dto';
import { SavePrintTemplateDto } from './dto/save-print-template.dto';
import { PrintTemplateExceptionFilter } from './print-template-exception.filter';
import { PrintTemplateService } from './print-template.service';
import {
  PrintTemplateDeleteResult,
  PrintTemplatePayload,
  PrintTemplateSuccessResponse,
} from './types/print-template-api.types';

/**
 * Three tables, one URL.
 *
 * POST /create saves the design whole: the template object, its `versions`
 * array, and each version's `datasets` array, in one transaction. GET /get
 * returns the same shape back, ready to edit and post again. There is
 * deliberately no per-version and no per-dataset endpoint — a revision is added
 * by posting the array it belongs to, and a dataset by posting the array on the
 * revision that owns it.
 */
@ApiTags('Print Template')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('print-templates')
@UseFilters(PrintTemplateExceptionFilter)
export class PrintTemplateController {
  constructor(private readonly printTemplateService: PrintTemplateService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Create or update a whole print template — header, revisions and datasets — in one call',
    description:
      'Object payload. Omit ptlId to create, send it to update; on update only the keys present ' +
      'in the body are written.\n\n' +
      "**The two arrays do not behave the same way, and the difference is the schema's.**\n\n" +
      '`versions` — omitted leaves the history alone; present inserts and updates the rows in ' +
      'it. A revision MISSING from the array is NOT deleted, because the version history is ' +
      'append-only (ux_ptv_template_rev is not partial on is_deleted). Removing one is an ' +
      'explicit `"ptvIsDeleted": true`, and is refused for a PUBLISHED revision or the one the ' +
      'template currently points at.\n\n' +
      '`datasets` — nested inside each version, because a dataset hangs off the VERSION: if it ' +
      'hung off the template, editing a query would silently change what every past version ' +
      "rendered. An array that is present REPLACES that version's set — rows with ptdId are " +
      'updated, rows without one are inserted, rows missing from it are soft deleted. Omit the ' +
      'key to leave them alone; `"datasets": []` means "delete every one", which is not the ' +
      'same thing.\n\n' +
      '**A published version is never UPDATEd.** print_log points at the exact bytes that were ' +
      'rendered. Send a version row with no ptvId to write the next revision instead; the only ' +
      'move still open to a live revision is RETIRED. A revision being published BY this ' +
      'request is not yet frozen, so composing a design and publishing it in one call works.\n\n' +
      "**Publishing** is setting a version's ptvStatus to PUBLISHED: it needs an approver, the " +
      "server stamps ptvApprovedOn, and the template's published pointer moves to that " +
      'revision. One per request — the template has one pointer.',
  })
  @ApiCreatedResponse({ type: PrintTemplateSuccessSingleDto })
  @ApiBadRequestResponse({ type: PrintTemplateErrorResponseDto })
  @ApiConflictResponse({ type: PrintTemplateErrorResponseDto })
  @ApiNotFoundResponse({ type: PrintTemplateErrorResponseDto })
  async saveTemplate(
    @Body() dto: SavePrintTemplateDto,
  ): Promise<PrintTemplateSuccessResponse<PrintTemplatePayload>> {
    const data = await this.printTemplateService.saveTemplate(dto);
    return {
      success: true,
      message: dto.ptlId
        ? 'Print template updated successfully'
        : 'Print template created successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: "Get one print template with every revision and each revision's datasets",
    description:
      'Returns the same shape POST /create accepts, ready to edit and post back. Revisions come ' +
      'newest first, and each carries ptvIsPublishedRev and ptvIsEditable so a designer knows ' +
      'what may still be changed before they try.',
  })
  @ApiOkResponse({ type: PrintTemplateSuccessSingleDto })
  @ApiBadRequestResponse({ type: PrintTemplateErrorResponseDto })
  @ApiNotFoundResponse({ type: PrintTemplateErrorResponseDto })
  async getTemplate(
    @Query() query: PrintTemplateIdQueryDto,
  ): Promise<PrintTemplateSuccessResponse<PrintTemplatePayload>> {
    const data = await this.printTemplateService.getTemplateById(
      query.ptlId,
      query.includeDeletedVersions ?? false,
    );
    return { success: true, message: 'Print template fetched successfully', data };
  }

  @Get('list')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'List print templates, paginated',
    description:
      'Every filter is an optional narrowing; a bare /list is every live template there is.\n\n' +
      'ptlCompanyId is NOT a plain column match: a shipped design (ptl_company_id NULL) is ' +
      'visible to every company, so narrowing to a company returns its own templates AND the ' +
      'shipped ones it can use. Pass onlyOwned=true for the other reading.\n\n' +
      '`engine` and `isPublished` ask about the PUBLISHED revision, which is why a template ' +
      'holding only a draft matches neither. Set includeVersions=false for a light pick list.',
  })
  @ApiOkResponse({ type: PrintTemplateSuccessListDto })
  @ApiBadRequestResponse({ type: PrintTemplateErrorResponseDto })
  async listTemplates(
    @Query() query: ListPrintTemplateQueryDto,
  ): Promise<PrintTemplateSuccessResponse<PrintTemplatePayload[]>> {
    const result = await this.printTemplateService.listTemplates(query);
    return {
      success: true,
      message: 'Print templates fetched successfully',
      data: result.items,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        total_pages: result.total_pages,
      },
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft delete a print template with every revision and dataset',
    description:
      'Soft, not hard: print_log still points at those revisions, and "what did this bill look ' +
      'like" has to keep answering after the design is withdrawn.\n\n' +
      'Refused while a print template assignment still points at the template — a counter would ' +
      'otherwise resolve to a design that is gone.',
  })
  @ApiOkResponse({ type: PrintTemplateSuccessDeleteDto })
  @ApiBadRequestResponse({ type: PrintTemplateErrorResponseDto })
  @ApiConflictResponse({ type: PrintTemplateErrorResponseDto })
  @ApiNotFoundResponse({ type: PrintTemplateErrorResponseDto })
  async deleteTemplate(
    @Query() query: DeletePrintTemplateQueryDto,
  ): Promise<PrintTemplateSuccessResponse<PrintTemplateDeleteResult>> {
    const data = await this.printTemplateService.softDeleteTemplate(
      query.ptlId,
      query.ptlModifiedBy,
    );
    return { success: true, message: 'Print template deleted successfully', data };
  }
}
