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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const node_util_1 = require("node:util");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const scryptAsync = (0, node_util_1.promisify)(node_crypto_1.scrypt);
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_LENGTH = 64;
let UsersService = class UsersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(createUserDto) {
        const username = createUserDto.user_name.trim();
        const userWithUsername = await this.prisma.user.findUnique({
            where: { user_name: username },
        });
        if (userWithUsername) {
            throw new common_1.ConflictException('User with this username already exists');
        }
        const hashedPassword = await this.hashPassword(createUserDto.user_password);
        return this.prisma.user.create({
            data: {
                user_name: username,
                user_password: hashedPassword,
            },
        });
    }
    async findAll() {
        return this.prisma.user.findMany();
    }
    async findByUsername(userName) {
        const normalizedUserName = userName.trim();
        if (!normalizedUserName) {
            return null;
        }
        return this.prisma.user.findUnique({
            where: {
                user_name: normalizedUserName,
            },
        });
    }
    async findOne(id) {
        return this.getUserOrThrow(id);
    }
    async update(id, updateUserDto) {
        const user = await this.getUserOrThrow(id);
        const nextUsername = updateUserDto.user_name?.trim();
        const nextPassword = updateUserDto.user_password;
        if (nextUsername && nextUsername !== user.user_name) {
            const usernameAlreadyUsed = await this.prisma.user.findUnique({
                where: { user_name: nextUsername },
            });
            if (usernameAlreadyUsed && usernameAlreadyUsed.user_id !== user.user_id) {
                throw new common_1.ConflictException('User with this username already exists');
            }
        }
        if (!nextUsername && nextPassword === undefined) {
            return user;
        }
        const data = {};
        if (nextUsername) {
            data.user_name = nextUsername;
        }
        if (nextPassword !== undefined) {
            data.user_password = await this.hashPassword(nextPassword);
        }
        return this.prisma.user.update({
            where: { user_id: user.user_id },
            data,
        });
    }
    async remove(id) {
        const result = await this.prisma.user.deleteMany({
            where: {
                user_id: id,
            },
        });
        if (result.count === 0) {
            throw new common_1.NotFoundException(`User with id ${id} not found`);
        }
    }
    async getUserOrThrow(id) {
        const user = await this.prisma.user.findUnique({
            where: {
                user_id: id,
            },
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        return user;
    }
    async hashPassword(plainPassword) {
        const salt = (0, node_crypto_1.randomBytes)(PASSWORD_SALT_BYTES).toString('hex');
        const derivedKey = (await scryptAsync(plainPassword, salt, PASSWORD_KEY_LENGTH));
        return `scrypt$${salt}$${derivedKey.toString('hex')}`;
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map