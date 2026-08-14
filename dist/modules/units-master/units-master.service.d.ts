import { PrismaService } from '../../database/prisma/prisma.service';
import { ListUnitQueryDto } from './dto/list-unit-query.dto';
import { SaveUnitDto } from './dto/save-unit.dto';
import { UnitListMeta, UnitPayload } from './types/unit-api.types';
export declare class UnitsMasterService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    save(saveUnitDto: SaveUnitDto): Promise<UnitPayload>;
    list(queryDto: ListUnitQueryDto): Promise<{
        items: UnitPayload[];
        meta: UnitListMeta;
    }>;
    getById(unitId: number): Promise<UnitPayload>;
    softDelete(unitId: number): Promise<{
        unit_id: number;
        deleted: true;
    }>;
    private createUnit;
    private updateUnit;
    private ensureBaseUnitExists;
    private validateConversionRules;
    private applyOptionalFields;
    private toPayload;
    private toNullableNumber;
    private resolveActor;
    private handleWriteError;
    private isUniqueConstraintError;
    private throwNotFound;
    private throwBadRequest;
    private buildErrorResponse;
    private hasOwnProperty;
}
