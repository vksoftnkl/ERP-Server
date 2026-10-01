import { GetMenuQueryDto } from './dto/get-menu-query.dto';
import { MenuMasterSuccessUpdateVisibilityDto } from './dto/menu-master-response.dto';
import { UpdateMenuVisibilityDto } from './dto/update-menu-visibility.dto';
import { MenuMasterService } from './menu-master.service';
import { MenuMasterGetMeta, MenuMasterPayload, MenuMasterSuccessResponse } from './types/menu-master-api.types';
export declare class MenuMasterController {
    private readonly menuMasterService;
    constructor(menuMasterService: MenuMasterService);
    get(queryDto: GetMenuQueryDto): Promise<MenuMasterSuccessResponse<MenuMasterPayload[], MenuMasterGetMeta>>;
    getUserMenu(): Promise<MenuMasterSuccessResponse<MenuMasterPayload[], MenuMasterGetMeta>>;
    updateVisibility(body: UpdateMenuVisibilityDto): Promise<MenuMasterSuccessUpdateVisibilityDto>;
}
