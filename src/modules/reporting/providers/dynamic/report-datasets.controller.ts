import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
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
import { ReportDataset } from '@prisma/client';
import { API_VERSION } from '../../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../../common/dto/http-error-response.dto';
import { OptionalQueryBoolean } from 'src/common/dto/dtoDecorators';
import { TemplatesSuccessResponse } from '../../templates/types/templates-api.types';
import { DatasetAdminGuard } from './guards/dataset-admin.guard';
import { ReportDatasetsService } from './report-datasets.service';
import {
  CreateReportDatasetDto,
  PreviewReportDatasetDto,
  ProbeReportDatasetDto,
  UpdateReportDatasetDto,
} from './dto/report-dataset-request.dto';

class ListReportDatasetsQueryDto {
  @OptionalQueryBoolean()
  includeInactive?: boolean;
}

/**
 * Runtime dataset authoring API — the vendor's half of the reporting feature.
 *
 * Every route is behind DatasetAdminGuard. That is not defence in depth, it is
 * THE defence: a dataset row is SQL, and the whole reason templates are safe to
 * let tenants author is that SQL never comes from tenant-authored content.
 *
 * Deliberately a separate controller from TemplatesController rather than more
 * routes on it. The template API is tenant-facing; this one is not, and mixing
 * them would make it one decorator's worth of oversight to expose authoring to
 * everybody who can open the designer.
 */
@ApiTags('Report Datasets (admin)')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({
  description: 'Caller is not a vendor administrator.',
  type: HttpErrorResponseDto,
})
@UseGuards(DatasetAdminGuard)
@Controller('reports/datasets')
export class ReportDatasetsController {
  constructor(private readonly datasets: ReportDatasetsService) {}

  @Get()
  @Version(API_VERSION)
  @ApiOperation({ summary: 'List runtime report datasets.' })
  async list(
    @Query() query: ListReportDatasetsQueryDto,
  ): Promise<TemplatesSuccessResponse<ReportDataset[], { count: number }>> {
    const data = await this.datasets.findAll(query.includeInactive === true);
    return {
      success: true,
      message: 'Report datasets fetched successfully',
      data,
      meta: { count: data.length },
    };
  }

  /**
   * Dry run. Mounted before `:id` so the literal path is not swallowed by the
   * uuid route.
   */
  @Post('probe')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Validate a candidate query and introspect its columns, without storing it.',
    description:
      'Returns the field list the designer would show. Use it to check a query while ' +
      'authoring — the same validation and introspection a save performs.',
  })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  async probe(
    @Body() dto: ProbeReportDatasetDto,
  ): Promise<TemplatesSuccessResponse<Awaited<ReturnType<ReportDatasetsService['probe']>>>> {
    return {
      success: true,
      message: 'Report dataset query validated successfully',
      data: await this.datasets.probe(dto),
    };
  }

  @Get(':id')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'One runtime report dataset.' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TemplatesSuccessResponse<ReportDataset>> {
    return {
      success: true,
      message: 'Report dataset fetched successfully',
      data: await this.datasets.findOne(id),
    };
  }

  @Get(':id/usage')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Templates that bind this dataset.',
    description: 'What a delete would break. Read this before deactivating a dataset.',
  })
  async usage(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TemplatesSuccessResponse<Array<{ pt_id: string; pt_name: string }>>> {
    const dataset = await this.datasets.findOne(id);
    return {
      success: true,
      message: 'Report dataset usage fetched successfully',
      data: await this.datasets.findTemplatesUsing(dataset.rdsToken),
    };
  }

  @Post()
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create a runtime report dataset.',
    description:
      'The query is validated and executed (WHERE false) before the row is written, so a ' +
      'dataset that cannot run is never stored. Field metadata is introspected from that ' +
      'run rather than supplied.',
  })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async create(
    @Body() dto: CreateReportDatasetDto,
  ): Promise<TemplatesSuccessResponse<ReportDataset>> {
    return {
      success: true,
      message: 'Report dataset created successfully',
      data: await this.datasets.create(dto),
    };
  }

  @Put(':id')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Update a runtime report dataset.',
    description:
      'The token is immutable — templates bind it by value, so a rename would break every ' +
      'design that uses it, silently, at print time.',
  })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReportDatasetDto,
  ): Promise<TemplatesSuccessResponse<ReportDataset>> {
    return {
      success: true,
      message: 'Report dataset updated successfully',
      data: await this.datasets.update(id, dto),
    };
  }

  @Post(':id/preview')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Run a stored dataset against the caller\'s own company, capped.',
    description:
      'The author\'s smoke test: real rows, real scoping, at most 100 of them. The company ' +
      'comes from the request context and is never a parameter.',
  })
  @ApiOkResponse({ description: 'Rows the dataset returns for the given context.' })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  async preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PreviewReportDatasetDto,
  ): Promise<TemplatesSuccessResponse<Awaited<ReturnType<ReportDatasetsService['preview']>>>> {
    return {
      success: true,
      message: 'Report dataset preview generated successfully',
      data: await this.datasets.preview(id, dto),
    };
  }

  @Delete(':id')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft-delete a runtime report dataset.',
    description:
      'Refused while a template still binds the token, because that template would then ' +
      'fail at print time rather than at save time. Pass force=true to override.',
  })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('force') force?: string,
  ): Promise<TemplatesSuccessResponse<{ rdsId: string; rdsToken: string }>> {
    return {
      success: true,
      message: 'Report dataset deleted successfully',
      data: await this.datasets.remove(id, force === 'true'),
    };
  }
}
