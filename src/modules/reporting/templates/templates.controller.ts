import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Version,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { ReportDataProviderRegistry } from '../providers/report-data-provider.registry';
import { GALLERY_TEMPLATES } from './gallery/gallery.index';
import {
  BAND_TYPES,
  ELEMENT_KINDS,
  LAYOUT_MODES,
  OUTPUT_MODES,
  SCHEMA_VERSION,
} from './dto/template-definition.schema';
import { PAPER_PRESETS } from '../engine/units/units';
import { TRANSFORM_NAMES } from '../engine/expression/jexl.factory';
import { BUILTIN_ROOT_IDENTIFIERS } from '../engine/expression/expression.validator';
import {
  CloneTemplateDto,
  CreateTemplateDto,
  GetTemplatesQueryDto,
  ImportTemplateDto,
  UpdateTemplateDto,
} from './dto/template-request.dto';
import { TemplatesService } from './templates.service';
import {
  TemplateDeleteResult,
  TemplateExportPayload,
  TemplateListMeta,
  TemplatePayload,
  TemplateRevisionPayload,
  TemplateSummaryPayload,
  TemplatesSuccessResponse,
} from './types/templates-api.types';

/**
 * Template storage API.
 *
 * Complete without any designer UI, which is the Fast Path's whole premise: the
 * development team authors a definition as JSON, POSTs it, clones it into a
 * tenant, and iterates by PUT. The designer, when it arrives, is a client of
 * exactly these endpoints and adds no server surface.
 */
@ApiTags('Report Templates')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('reports/templates')
export class TemplatesController {
  constructor(
    private readonly templatesService: TemplatesService,
    private readonly providers: ReportDataProviderRegistry,
  ) {}

  @Get()
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'List templates for the request context company, plus the shipped system ' +
      'templates. Filterable by document type, output mode and paper.',
  })
  async list(
    @Query() query: GetTemplatesQueryDto,
  ): Promise<TemplatesSuccessResponse<TemplateSummaryPayload[], TemplateListMeta>> {
    const result = await this.templatesService.list(query);

    return {
      success: true,
      message: 'Report templates fetched successfully',
      data: result.items,
      meta: {
        count: result.items.length,
        docType: query.ptDocType,
        outputMode: query.ptOutputMode,
        paperCode: query.ptPaperCode,
        companyId: query.ptCompanyId,
        includeSystem: result.includeSystem,
      },
    };
  }

  /**
   * The vocabulary a designer needs to build its palette.
   *
   * Served from the same constants the validator enforces, so the designer can
   * never offer a band type or transform the server would then reject.
   */
  @Get('schema')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'The template definition vocabulary: bands, elements, papers, transforms.',
  })
  @ApiOkResponse({ description: 'Vocabulary for the designer palette.' })
  schema(): TemplatesSuccessResponse<Record<string, unknown>> {
    return {
      success: true,
      message: 'Template schema vocabulary fetched successfully',
      data: {
        schemaVersion: SCHEMA_VERSION,
        layoutModes: LAYOUT_MODES,
        outputModes: OUTPUT_MODES,
        bandTypes: BAND_TYPES,
        elementKinds: ELEMENT_KINDS,
        papers: PAPER_PRESETS,
        transforms: TRANSFORM_NAMES,
        rootIdentifiers: BUILTIN_ROOT_IDENTIFIERS,
        gallery: GALLERY_TEMPLATES.map((entry) => ({
          key: entry.key,
          name: entry.name,
          docType: entry.docType,
          outputMode: entry.outputMode,
          paperCode: entry.paperCode,
        })),
      },
    };
  }

  @Get(':id')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'One template with its definition, migrated to the current schema.' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiForbiddenResponse({ type: HttpErrorResponseDto })
  async findOne(
    @Param('id', ParseUUIDPipe) ptId: string,
  ): Promise<TemplatesSuccessResponse<TemplatePayload>> {
    return {
      success: true,
      message: 'Report template fetched successfully',
      data: await this.templatesService.findOne(ptId),
    };
  }

  @Post()
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Create a template. The definition is validated in full — schema, ' +
      'expressions and provider tokens — before anything is stored.',
  })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async create(@Body() dto: CreateTemplateDto): Promise<TemplatesSuccessResponse<TemplatePayload>> {
    return {
      success: true,
      message: 'Report template created successfully',
      data: await this.templatesService.create(dto),
    };
  }

  @Put(':id')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Update a template. Supplying a definition bumps the version and archives ' +
      'the previous body as a revision.',
  })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiForbiddenResponse({ type: HttpErrorResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) ptId: string,
    @Body() dto: UpdateTemplateDto,
  ): Promise<TemplatesSuccessResponse<TemplatePayload>> {
    return {
      success: true,
      message: 'Report template updated successfully',
      data: await this.templatesService.update(ptId, dto),
    };
  }

  @Delete(':id')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Soft delete a template. Refused while it is the default for its scope, ' +
      'or while clones descend from it.',
  })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async remove(
    @Param('id', ParseUUIDPipe) ptId: string,
  ): Promise<TemplatesSuccessResponse<TemplateDeleteResult>> {
    return {
      success: true,
      message: 'Report template deleted successfully',
      data: await this.templatesService.softDelete(ptId),
    };
  }

  @Post(':id/clone')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Clone a template into a tenant. This is how a shipped system design is ' +
      'customised — system templates are read-only.',
  })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async clone(
    @Param('id', ParseUUIDPipe) ptId: string,
    @Body() dto: CloneTemplateDto,
  ): Promise<TemplatesSuccessResponse<TemplatePayload>> {
    return {
      success: true,
      message: 'Report template cloned successfully',
      data: await this.templatesService.clone(ptId, dto),
    };
  }

  @Put(':id/set-default')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Make this template the default for its company/branch/docType/mode/paper.',
  })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async setDefault(
    @Param('id', ParseUUIDPipe) ptId: string,
  ): Promise<TemplatesSuccessResponse<TemplateSummaryPayload>> {
    return {
      success: true,
      message: 'Report template promoted to default successfully',
      data: await this.templatesService.setDefault(ptId),
    };
  }

  @Get(':id/revisions')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Version history, newest first.' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async revisions(
    @Param('id', ParseUUIDPipe) ptId: string,
  ): Promise<TemplatesSuccessResponse<TemplateRevisionPayload[], { count: number }>> {
    const data = await this.templatesService.listRevisions(ptId);
    return {
      success: true,
      message: 'Report template revisions fetched successfully',
      data,
      meta: { count: data.length },
    };
  }

  @Post(':id/rollback/:version')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Roll back to an archived version. The old body is written FORWARD as a ' +
      'new version, so the history stays append-only.',
  })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async rollback(
    @Param('id', ParseUUIDPipe) ptId: string,
    @Param('version', ParseIntPipe) version: number,
  ): Promise<TemplatesSuccessResponse<TemplatePayload>> {
    return {
      success: true,
      message: `Report template rolled back to version ${version} successfully`,
      data: await this.templatesService.rollback(ptId, version),
    };
  }

  @Get(':id/export')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Export a template as a portable JSON file.' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async export(
    @Param('id', ParseUUIDPipe) ptId: string,
  ): Promise<TemplatesSuccessResponse<TemplateExportPayload>> {
    return {
      success: true,
      message: 'Report template exported successfully',
      data: await this.templatesService.export(ptId),
    };
  }

  @Post('import')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Import an exported template. Older exports are migrated forward, then ' +
      'validated exactly as a create would be.',
  })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async import(@Body() dto: ImportTemplateDto): Promise<TemplatesSuccessResponse<TemplatePayload>> {
    return {
      success: true,
      message: 'Report template imported successfully',
      data: await this.templatesService.import(dto),
    };
  }

  /**
   * Dataset catalogue for the designer's field tree.
   *
   * Mounted under templates rather than as its own controller because it is
   * only ever consumed alongside a template: the field tree exists to be
   * dragged onto a canvas.
   */
  @Get('datasets/catalogue')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Registered dataset providers with their field metadata, for the designer field tree.',
  })
  datasets(
    @Query('docType') docType?: string,
  ): TemplatesSuccessResponse<ReturnType<ReportDataProviderRegistry['list']>, { count: number }> {
    const data = this.providers.list(docType);
    return {
      success: true,
      message: 'Report dataset providers fetched successfully',
      data,
      meta: { count: data.length },
    };
  }
}
