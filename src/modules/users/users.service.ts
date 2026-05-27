import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, scrypt as nodeScrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { Prisma, UserMaster } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
const scryptAsync = promisify(nodeScrypt);
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_LENGTH = 64;
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}
  async create(createUserDto: CreateUserDto): Promise<UserMaster> {
    const username = createUserDto.user_name.trim();
    const existing = await this.prisma.userMaster.findFirst({
      where: { usrLoginName: { equals: username, mode: 'insensitive' }, usrIsDeleted: false },
    });
    if (existing) {
      throw new ConflictException('User with this username already exists');
    }
    const hashedPassword = await this.hashPassword(createUserDto.user_password);
    return this.prisma.userMaster.create({
      data: {
        usrLoginName: username,
        usrDisplayName: username,
        usrMobileNo: createUserDto.user_phone?.trim() || null,
        usrPasswordHash: hashedPassword,
      },
    });
  }
  async findAll(): Promise<UserMaster[]> {
    return this.prisma.userMaster.findMany({ where: { usrIsDeleted: false } });
  }
  async findByUsername(userName: string): Promise<UserMaster | null> {
    const normalizedUserName = userName.trim();
    if (!normalizedUserName) return null;
    return this.prisma.userMaster.findFirst({
      where: {
        usrLoginName: { equals: normalizedUserName, mode: 'insensitive' },
        usrIsDeleted: false,
      },
    });
  }
  async findOne(id: string): Promise<UserMaster> {
    return this.getUserOrThrow(id);
  }
  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserMaster> {
    const user = await this.getUserOrThrow(id);
    const nextUsername = updateUserDto.user_name?.trim();
    const nextPassword = updateUserDto.user_password;
    if (nextUsername && nextUsername !== user.usrLoginName) {
      const taken = await this.prisma.userMaster.findFirst({
        where: {
          usrLoginName: { equals: nextUsername, mode: 'insensitive' },
          usrIsDeleted: false,
          NOT: { usrId: id },
        },
      });
      if (taken) {
        throw new ConflictException('User with this username already exists');
      }
    }
    if (!nextUsername && updateUserDto.user_phone === undefined && nextPassword === undefined) {
      return user;
    }
    const data: Prisma.UserMasterUncheckedUpdateInput = { usrModifiedOn: new Date() };
    if (nextUsername) {
      data.usrLoginName = nextUsername;
      data.usrDisplayName = nextUsername;
    }
    if (updateUserDto.user_phone !== undefined) {
      data.usrMobileNo = updateUserDto.user_phone.trim() || null;
    }
    if (nextPassword !== undefined) {
      data.usrPasswordHash = await this.hashPassword(nextPassword);
    }
    return this.prisma.userMaster.update({ where: { usrId: id }, data });
  }
  async remove(id: string): Promise<void> {
    const result = await this.prisma.userMaster.updateMany({
      where: { usrId: id, usrIsDeleted: false },
      data: { usrIsDeleted: true, usrIsActive: false, usrModifiedOn: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
  }
  private async getUserOrThrow(id: string): Promise<UserMaster> {
    const user = await this.prisma.userMaster.findFirst({
      where: { usrId: id, usrIsDeleted: false },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
  private async hashPassword(plainPassword: string): Promise<string> {
    const salt = randomBytes(PASSWORD_SALT_BYTES).toString('hex');
    const derivedKey = (await scryptAsync(plainPassword, salt, PASSWORD_KEY_LENGTH)) as Buffer;
    return `scrypt$${salt}$${derivedKey.toString('hex')}`;
  }
}