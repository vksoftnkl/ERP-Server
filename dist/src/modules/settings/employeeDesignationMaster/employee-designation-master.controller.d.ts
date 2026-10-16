import { SaveEmployeeDesignationMasterDto } from './dto/save-employee-designation-master.dto';
import { EmployeeDesignationMasterService } from './employee-designation-master.service';
import { EmployeeDesignationMasterPayload, EmployeeDesignationMasterSuccessResponse } from './types/employee-designation-master-api.types';
export declare class EmployeeDesignationMasterController {
    private readonly employeeDesignationMasterService;
    constructor(employeeDesignationMasterService: EmployeeDesignationMasterService);
    save(saveEmployeeDesignationMasterDto: SaveEmployeeDesignationMasterDto): Promise<EmployeeDesignationMasterSuccessResponse<EmployeeDesignationMasterPayload>>;
    getById(edId: string): Promise<EmployeeDesignationMasterSuccessResponse<EmployeeDesignationMasterPayload>>;
    remove(edId: string): Promise<EmployeeDesignationMasterSuccessResponse<{
        edId: string;
        deleted: true;
    }>>;
}
