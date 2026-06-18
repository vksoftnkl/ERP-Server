import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Delete,
  Get,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseFilters,
  Version,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { ListWidgetQueryDto } from './dto/list-widget-query.dto';
import { WidgetConfigQueryDto } from './dto/widget-config-query.dto';
import { UpdateWidgetVisibilityDto } from './dto/update-widget-visibility.dto';
import { SaveWidgetDto } from './dto/save-widget.dto';
import {
  WidgetMasterErrorResponseDto,
  WidgetMasterSuccessDeleteDto,
  WidgetMasterSuccessListDto,
  WidgetMasterSuccessSingleDto,
} from './dto/widget-master-response.dto';
import {
  WidgetMasterPayload,
  WidgetMasterSuccessResponse,
  WidgetPlatform,
} from './types/widget-master-api.types';
import { WidgetMasterExceptionFilter } from './widget-master-exception.filter';
import { WidgetMasterService } from './widget-master.service';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('Widget Master')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('widget-masters')
@UseFilters(WidgetMasterExceptionFilter)
export class WidgetMasterController {
  constructor(private readonly widgetMasterService: WidgetMasterService) { }
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update a widget section with its fields',
    description: [
      'Upserts a single form section (heading row) together with its nested fields.',
      '',
      '- Omit `sectionId` to create a new section; include it to update the existing one.',
      '- `fields` is a full-sync of the section\'s children: fields with a `fieldId` are updated, fields without one are created, and any existing field not present in the array is deleted.',
      '- Omit `fields` entirely to leave the existing fields untouched; send `[]` to remove all fields.',
      '- `(sectionMenuId, sectionPlatform, sectionName)` must be unique, and `fieldName` must be unique within a section — violations return 409.',
    ].join('\n'),
  })
  @ApiBody({
    type: SaveWidgetDto,
    examples: {
      createWithFields: {
        summary: 'Create a section with two fields',
        value: {
          sectionMenuId: 10,
          sectionName: 'Primary Information',
          sectionPosition: 0,
          sectionVisibility: true,
          sectionPlatform: WidgetPlatform.Web,
          fields: [
            {
              fieldName: 'item_name',
              fieldGuiName: 'English Name',
              fieldSecondaryText: 'Secondary text',
              fieldPosition: 0,
              fieldVisibility: true,
            },
            {
              fieldName: 'item_code',
              fieldGuiName: 'Code',
              fieldPosition: 1,
              fieldVisibility: true,
            },
          ],
        },
      },
      createSectionOnly: {
        summary: 'Create a section without any fields',
        value: {
          sectionMenuId: 10,
          sectionName: 'Price Details',
          sectionPlatform: WidgetPlatform.Desktop,
        },
      },
      updateWithFieldSync: {
        summary: 'Update a section and sync its fields (update one, add one, drop the rest)',
        value: {
          sectionId: 1,
          sectionMenuId: 10,
          sectionName: 'Primary Information',
          sectionPosition: 0,
          sectionVisibility: true,
          sectionPlatform: WidgetPlatform.Web,
          fields: [
            { fieldId: 5, fieldName: 'item_name', fieldGuiName: 'English Name', fieldPosition: 0 },
            { fieldName: 'item_barcode', fieldGuiName: 'Barcode', fieldPosition: 1 },
          ],
        },
      },
    },
  })
  @ApiCreatedResponse({ type: WidgetMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: WidgetMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: WidgetMasterErrorResponseDto })
  async save(
    @Body() saveWidgetDto: SaveWidgetDto,
  ): Promise<WidgetMasterSuccessResponse<WidgetMasterPayload>> {
    const data = await this.widgetMasterService.save(saveWidgetDto);

    return {
      success: true,
      message: saveWidgetDto.sectionId
        ? 'Widget section updated successfully'
        : 'Widget section created successfully',
      data,
    };
  }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Get widget section by id',
    description: [
      'Returns sections (each with its `fields[]` ordered by position), without pagination.',
      'Optional filters: `sectionId` (screen) and `sectionPlatform`.',
      '`search` matches the section name or any of its field names (name / GUI name / secondary text), case-insensitive.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: WidgetMasterSuccessListDto })
  @ApiBadRequestResponse({ type: WidgetMasterErrorResponseDto })
  async list(
    @Query() queryDto: ListWidgetQueryDto,
  ): Promise<WidgetMasterSuccessResponse<WidgetMasterPayload[]>> {
    const data = await this.widgetMasterService.list(queryDto);
    return {
      success: true,
      message: 'Widgets fetched successfully',
      data,
    };
  }
  @Get('config')
  @Version(API_VERSION)
  @ApiOperation({
    summary: "Get a menu's widget config, optionally filtered by visibility",
    description: [
      'Returns the sections (each with its `fields[]` ordered by position) for `menu_id`.',
      'The optional `visibility` filter accepts `false` or `all`:',
      '- `visibility=false` returns only hidden sections, each carrying its hidden fields plus any field that has secondary text (even when that field is itself visible).',
      '- `visibility=all` (or omitting it) returns both visible and hidden sections (and their fields).',
      'The optional `platform` filter restricts results to sections scoped to that platform; omit it to return all platforms.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: WidgetMasterSuccessListDto })
  @ApiBadRequestResponse({ type: WidgetMasterErrorResponseDto })
  async getConfig(
    @Query() queryDto: WidgetConfigQueryDto,
  ): Promise<WidgetMasterSuccessResponse<WidgetMasterPayload[]>> {
    const data = await this.widgetMasterService.getConfig(queryDto);
    return {
      success: true,
      message: 'Widget config fetched successfully',
      data,
    };
  }
  @Patch('visibility')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Update section and field visibility config in bulk',
    description: [
      'Updates the visibility configuration for one or more sections together with their fields.',
      '',
      "- Each section's `sectionVisibility` / `sectionGuiName` is updated by `sectionId`.",
      "- Each field's `fieldVisibility` / `fieldSecondaryText` is updated by `fieldId` (the field must belong to its section).",
      '- All updates run in a single transaction: if any `sectionId`/`fieldId` is missing, nothing is changed (404).',
    ].join('\n'),
  })
  @ApiBody({
    type: UpdateWidgetVisibilityDto,
    examples: {
      updateVisibility: {
        summary: 'Update one section and one of its fields',
        value: {
          data: [
            {
              sectionId: 1,
              sectionGuiName: 'Primary Information',
              sectionVisibility: true,
              fields: [
                {
                  fieldId: 1,
                  fieldSecondaryText: 'Secondary text',
                  fieldVisibility: true,
                },
              ],
            },
          ],
        },
      },
    },
  })
  @ApiOkResponse({ type: WidgetMasterSuccessListDto })
  @ApiBadRequestResponse({ type: WidgetMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: WidgetMasterErrorResponseDto })
  async updateVisibility(
    @Body() updateWidgetVisibilityDto: UpdateWidgetVisibilityDto,
  ): Promise<WidgetMasterSuccessResponse<WidgetMasterPayload[]>> {
    const data = await this.widgetMasterService.updateVisibility(updateWidgetVisibilityDto);
    return {
      success: true,
      message: 'Widget visibility updated successfully',
      data,
    };
  }
  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Delete a widget section by id',
    description: 'Deletes the section identified by `sectionId`. All of its fields are removed automatically via the database cascade.',
  })
  @ApiQuery({ name: 'sectionId', type: Number, example: 1 })
  @ApiOkResponse({ type: WidgetMasterSuccessDeleteDto })
  @ApiBadRequestResponse({ type: WidgetMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: WidgetMasterErrorResponseDto })
  async remove(
    @Query('sectionId', ParseIntPipe) sectionId: number,
  ): Promise<WidgetMasterSuccessResponse<{ sectionId: number; deleted: true }>> {
    const data = await this.widgetMasterService.delete(sectionId);
    return {
      success: true,
      message: 'Widget section deleted successfully',
      data,
    };
  }
}