import { SaveUserAdministrationDto } from './dto/save-user-administration.dto';
import { UserAdministrationService } from './user-administration.service';
import { UserAdminPayload, UserAdminSuccessResponse } from './types/user-administration-api.types';
export declare class UserAdministrationController {
    private readonly userAdministrationService;
    constructor(userAdministrationService: UserAdministrationService);
    save(dto: SaveUserAdministrationDto): Promise<UserAdminSuccessResponse<UserAdminPayload>>;
    getById(usrId: string): Promise<UserAdminSuccessResponse<UserAdminPayload>>;
    remove(usrId: string): Promise<UserAdminSuccessResponse<{
        usrId: string;
        deleted: true;
    }>>;
}
