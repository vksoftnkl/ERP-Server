import { CacheTTL } from '@nestjs/cache-manager';
import { Body, Controller, Get, Patch, Query, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { GetMenuQueryDto } from './dto/get-menu-query.dto';
import {
  MenuMasterErrorResponseDto,
  MenuMasterSuccessGetDto,
  MenuMasterSuccessUpdateVisibilityDto,
} from './dto/menu-master-response.dto';
import { UpdateMenuVisibilityDto } from './dto/update-menu-visibility.dto';
import { MenuMasterService } from './menu-master.service';
import {
  MenuMasterGetMeta,
  MenuMasterPayload,
  MenuMasterSuccessResponse,
} from './types/menu-master-api.types';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('Menu Master')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('menu-masters')
export class MenuMasterController {
  constructor(private readonly menuMasterService: MenuMasterService) {}
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Get menus for the authenticated user (filtered by UserMenus permissions).',
  })
  @ApiOkResponse({ type: MenuMasterSuccessGetDto })
  @ApiBadRequestResponse({ type: MenuMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: MenuMasterErrorResponseDto })
  async get(
    @Query() queryDto: GetMenuQueryDto,
  ): Promise<MenuMasterSuccessResponse<MenuMasterPayload[], MenuMasterGetMeta>> {
    const result = await this.menuMasterService.get(queryDto);

    return {
      success: true,
      message:
        queryDto.menuId !== undefined ? 'Menu fetched successfully' : 'Menus fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }
  @Patch('visibility')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Update menu_visibility for one or more menus.' })
  @ApiOkResponse({ type: MenuMasterSuccessUpdateVisibilityDto })
  @ApiBadRequestResponse({ type: MenuMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: MenuMasterErrorResponseDto })
  async updateVisibility(
    @Body() body: UpdateMenuVisibilityDto,
  ): Promise<MenuMasterSuccessUpdateVisibilityDto> {
    const data = await this.menuMasterService.updateVisibility(body.menus);
    return {
      success: true,
      message: 'Menu visibility updated successfully',
      data,
    };
  }
}