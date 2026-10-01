"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const http_error_response_dto_1 = require("../../common/dto/http-error-response.dto");
const create_user_dto_1 = require("./dto/create-user.dto");
const update_user_dto_1 = require("./dto/update-user.dto");
const user_response_dto_1 = require("./dto/user-response.dto");
const users_service_1 = require("./users.service");
const api_version_1 = require("../../common/constants/api-version");
let UsersController = class UsersController {
    usersService;
    constructor(usersService) {
        this.usersService = usersService;
    }
    async create(createUserDto) {
        const user = await this.usersService.create(createUserDto);
        return this.toResponse(user);
    }
    async findAll() {
        const users = await this.usersService.findAll();
        return users.map((user) => this.toResponse(user));
    }
    async findOne(id) {
        const user = await this.usersService.findOne(id);
        return this.toResponse(user);
    }
    async update(id, updateUserDto) {
        const user = await this.usersService.update(id, updateUserDto);
        return this.toResponse(user);
    }
    async remove(id) {
        await this.usersService.remove(id);
    }
    toResponse(user) {
        return {
            usrId: user.usrId,
            usrLoginName: user.usrLoginName,
            usrMobileNo: user.usrMobileNo,
            usrIsActive: user.usrIsActive,
            usrCreatedOn: user.usrCreatedOn.toISOString(),
            usrModifiedOn: user.usrModifiedOn?.toISOString() ?? null,
        };
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create user' }),
    (0, swagger_1.ApiCreatedResponse)({ type: user_response_dto_1.UserResponseDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_user_dto_1.CreateUserDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'List users' }),
    (0, swagger_1.ApiOkResponse)({ type: user_response_dto_1.UserResponseDto, isArray: true }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get user by id' }),
    (0, swagger_1.ApiQuery)({ name: 'id', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: user_response_dto_1.UserResponseDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Update user by id' }),
    (0, swagger_1.ApiParam)({ name: 'id', format: 'uuid' }),
    (0, swagger_1.ApiOkResponse)({ type: user_response_dto_1.UserResponseDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_user_dto_1.UpdateUserDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Delete user by id' }),
    (0, swagger_1.ApiQuery)({ name: 'id', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiNoContentResponse)({ description: 'User deleted' }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "remove", null);
exports.UsersController = UsersController = __decorate([
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiTags)('Users'),
    (0, cache_manager_1.CacheTTL)(0),
    (0, common_1.Controller)('users'),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], UsersController);
//# sourceMappingURL=users.controller.js.map