import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { GetMenuQueryDto } from './dto/get-menu-query.dto';
import { MenuMasterGetMeta, MenuMasterPayload } from './types/menu-master-api.types';
export declare class MenuMasterService {
    private readonly prisma;
    private readonly requestContextService;
    constructor(prisma: PrismaService, requestContextService: RequestContextService);
    get(queryDto: GetMenuQueryDto): Promise<{
        items: MenuMasterPayload[];
        meta: MenuMasterGetMeta;
    }>;
    getUserMenu(): Promise<{
        items: MenuMasterPayload[];
        meta: MenuMasterGetMeta;
    }>;
    updateVisibility(items: {
        menuId: number;
        menuVisibility: boolean;
    }[]): Promise<{
        menuId: number;
        menuVisibility: boolean;
    }[]>;
    private buildResponse;
    private groupByParent;
    private getRootRecords;
    private toSimplePayload;
}
