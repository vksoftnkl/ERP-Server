import { CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, Query, Version } from '@nestjs/common';
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
} from './dto/menu-master-response.dto';
import { MenuMasterService } from './menu-master.service';
import {
  MenuMasterGetMeta,
  MenuMasterPayload,
  MenuMasterSuccessResponse,
} from './types/menu-master-api.types';

@ApiTags('Menu Master')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(86400)
@Controller('menu-masters')
export class MenuMasterController {
  constructor(private readonly menuMasterService: MenuMasterService) {}

  @Get('get')
  @Version('1')
  @ApiOperation({
    summary:
      'Get menu records from fixed.menu_master by menuId or parentId. Defaults to top-level modules.',
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
}
