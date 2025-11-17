import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserDataService } from '../../application/services/user-data.service';

@Controller('resume/user-data')
export class UserDataController {
  constructor(private readonly userDataService: UserDataService) {}

  @Get()
  async getUserData(@Query('userId') userId: string) {
    // Note: In production, userId should come from auth token, not query
    return this.userDataService.getUserData(userId);
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  async updateUserData(
    @Body() body: {
      userId: string;
      data: {
        name?: string;
        address?: string;
        phone?: string;
        email?: string;
        website?: string;
        linkedin?: string;
        github?: string;
      };
    },
  ) {
    return this.userDataService.updateUserData(body.userId, body.data);
  }
}
