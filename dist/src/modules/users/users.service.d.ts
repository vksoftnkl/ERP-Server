import { UserMaster } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(createUserDto: CreateUserDto): Promise<UserMaster>;
    findAll(): Promise<UserMaster[]>;
    findByUsername(userName: string): Promise<UserMaster | null>;
    findOne(id: string): Promise<UserMaster>;
    update(id: string, updateUserDto: UpdateUserDto): Promise<UserMaster>;
    remove(id: string): Promise<void>;
    private getUserOrThrow;
    private hashPassword;
}
