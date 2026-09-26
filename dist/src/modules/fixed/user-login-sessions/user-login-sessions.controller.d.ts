import { ListUserLoginSessionsQueryDto } from './dto/list-user-login-sessions-query.dto';
import { SaveUserLoginSessionDto } from './dto/save-user-login-session.dto';
import { UserLoginSessionsService } from './user-login-sessions.service';
import { UserLoginSessionsListItem, UserLoginSessionsListMeta, UserLoginSessionsPayload, UserLoginSessionsSuccessResponse } from './types/user-login-sessions-api.types';
export declare class UserLoginSessionsController {
    private readonly userLoginSessionsService;
    constructor(userLoginSessionsService: UserLoginSessionsService);
    save(saveUserLoginSessionDto: SaveUserLoginSessionDto): Promise<UserLoginSessionsSuccessResponse<UserLoginSessionsPayload>>;
    list(queryDto: ListUserLoginSessionsQueryDto): Promise<UserLoginSessionsSuccessResponse<UserLoginSessionsListItem[], UserLoginSessionsListMeta>>;
    getById(ulsId: string): Promise<UserLoginSessionsSuccessResponse<UserLoginSessionsPayload>>;
    remove(ulsId: string): Promise<UserLoginSessionsSuccessResponse<{
        ulsId: string;
        deleted: true;
    }>>;
}
