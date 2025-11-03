import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { IUserRepository, USER_REPOSITORY } from '../../application/ports/user-repository.port';

@Controller('internal/users')
export class UsersController {
  constructor(@Inject(USER_REPOSITORY) private readonly users: IUserRepository) {}
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getById(@Param('id') id: string) {
    return (await this.users.findById(id)) ?? {};
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getByEmail(@Query('email') email?: string) {
    if (!email) return [];
    const user = await this.users.findByEmail(email);
    return user ? [user] : [];
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(@Param('id') id: string, @Body() body: any) {
    return await this.users.update(id, body);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: any) {
    return await this.users.create(body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.users.delete(id);
    return {};
  }
}


