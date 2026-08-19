import { SaveEmployeeMasterDto } from './dto/save-employee-master.dto';
import { EmployeeMasterService } from './employee-master.service';
import { EmployeeMasterPayload, EmployeeMasterSuccessResponse } from './types/employee-master-api.types';
export declare class EmployeeMasterController {
    private readonly employeeMasterService;
    constructor(employeeMasterService: EmployeeMasterService);
    save(saveEmployeeMasterDto: SaveEmployeeMasterDto): Promise<EmployeeMasterSuccessResponse<EmployeeMasterPayload>>;
    getById(empId: string): Promise<EmployeeMasterSuccessResponse<EmployeeMasterPayload>>;
    remove(empId: string): Promise<EmployeeMasterSuccessResponse<{
        empId: string;
        deleted: true;
    }>>;
}
