import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, scrypt as nodeScrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { User } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
const scryptAsync = promisify(nodeScrypt);
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_LENGTH = 64;
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}
  async create(createUserDto: CreateUserDto): Promise<User> {
    const username = createUserDto.user_name.trim();
    const userPhone = createUserDto.user_phone.trim();
    const userWithUsername = await this.prisma.user.findUnique({
      where: { user_name: username },
    });
    if (userWithUsername) {
      throw new ConflictException('User with this username already exists');
    }
    const userWithPhone = await this.prisma.user.findUnique({
      where: { user_phone: userPhone },
    });
    if (userWithPhone) {
      throw new ConflictException('User with this phone already exists');
    }
    const hashedPassword = await this.hashPassword(createUserDto.user_password);
    return this.prisma.user.create({
      data: {
        user_phone: userPhone,
        user_name: username,
        user_password: hashedPassword,
      },
    });
  }
  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany();
  }
  async findByUsername(userName: string): Promise<User | null> {
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
  async findOne(id: string): Promise<User> {
    return this.getUserOrThrow(id);
  }
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.getUserOrThrow(id);
    const nextUsername = updateUserDto.user_name?.trim();
    const nextUserPhone = updateUserDto.user_phone?.trim();
    const nextPassword = updateUserDto.user_password;
    if (nextUsername && nextUsername !== user.user_name) {
      const usernameAlreadyUsed = await this.prisma.user.findUnique({
        where: { user_name: nextUsername },
      });
      if (usernameAlreadyUsed && usernameAlreadyUsed.user_id !== user.user_id) {
        throw new ConflictException('User with this username already exists');
      }
    }
    if (nextUserPhone && nextUserPhone !== user.user_phone) {
      const phoneAlreadyUsed = await this.prisma.user.findUnique({
        where: { user_phone: nextUserPhone },
      });
      if (phoneAlreadyUsed && phoneAlreadyUsed.user_id !== user.user_id) {
        throw new ConflictException('User with this phone already exists');
      }
    }
    if (!nextUsername && !nextUserPhone && nextPassword === undefined) {
      return user;
    }
    const data: Partial<Pick<User, 'user_name' | 'user_phone' | 'user_password'>> = {};
    if (nextUsername) {
      data.user_name = nextUsername;
    }
    if (nextUserPhone) {
      data.user_phone = nextUserPhone;
    }
    if (nextPassword !== undefined) {
      data.user_password = await this.hashPassword(nextPassword);
    }
    return this.prisma.user.update({
      where: { user_id: user.user_id },
      data,
    });
  }
  async remove(id: string): Promise<void> {
    const result = await this.prisma.user.deleteMany({
      where: {
        user_id: id,
      },
    });
    if (result.count === 0) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
  }
  private async getUserOrThrow(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: {
        user_id: id,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
  private async hashPassword(plainPassword: string): Promise<string> {
    const salt = randomBytes(PASSWORD_SALT_BYTES).toString('hex');
    const derivedKey = (await scryptAsync(plainPassword, salt, PASSWORD_KEY_LENGTH)) as Buffer;
    return `scrypt$${salt}$${derivedKey.toString('hex')}`;
  }
}