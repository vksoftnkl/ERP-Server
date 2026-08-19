import { SaveEmployeeDepartmentMasterDto } from './dto/save-employee-department-master.dto';
import { EmployeeDepartmentMasterService } from './employee-department-master.service';
import { EmployeeDepartmentMasterPayload, EmployeeDepartmentMasterSuccessResponse } from './types/employee-department-master-api.types';
export declare class EmployeeDepartmentMasterController {
    private readonly employeeDepartmentMasterService;
    constructor(employeeDepartmentMasterService: EmployeeDepartmentMasterService);
    save(saveEmployeeDepartmentMasterDto: SaveEmployeeDepartmentMasterDto): Promise<EmployeeDepartmentMasterSuccessResponse<EmployeeDepartmentMasterPayload>>;
    getById(edptId: string): Promise<EmployeeDepartmentMasterSuccessResponse<EmployeeDepartmentMasterPayload>>;
    remove(edptId: string): Promise<EmployeeDepartmentMasterSuccessResponse<{
        edptId: string;
        deleted: true;
    }>>;
}
