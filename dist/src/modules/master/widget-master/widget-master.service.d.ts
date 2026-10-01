import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { ListWidgetQueryDto } from './dto/list-widget-query.dto';
import { WidgetConfigQueryDto } from './dto/widget-config-query.dto';
import { UpdateWidgetVisibilityDto } from './dto/update-widget-visibility.dto';
import { SaveWidgetDto } from './dto/save-widget.dto';
import { SaveBulkWidgetDto } from './dto/save-bulk-widget.dto';
import { WidgetMasterPayload } from './types/widget-master-api.types';
export declare class WidgetMasterService {
    private readonly prisma;
    private readonly requestContextService;
    constructor(prisma: PrismaService, requestContextService: RequestContextService);
    save(saveWidgetDto: SaveWidgetDto): Promise<WidgetMasterPayload>;
    saveBulk(saveBulkWidgetDto: SaveBulkWidgetDto): Promise<WidgetMasterPayload[]>;
    list(queryDto: ListWidgetQueryDto): Promise<WidgetMasterPayload[]>;
    getConfig(queryDto: WidgetConfigQueryDto): Promise<WidgetMasterPayload[]>;
    updateVisibility(dto: UpdateWidgetVisibilityDto): Promise<WidgetMasterPayload[]>;
    delete(sectionId: number): Promise<{
        sectionId: number;
        deleted: true;
    }>;
    private saveSectionTx;
    private createSectionTx;
    private updateSectionTx;
    private syncFields;
    private buildFieldCreateData;
    private buildFieldUpdateData;
    private buildSearchConditions;
    private toPayload;
    private toFieldPayload;
    private getActor;
    private normalizeSectionId;
    private normalizeFieldId;
    private throwNotFound;
    private throwFieldNotFound;
    private throwBadRequest;
}
