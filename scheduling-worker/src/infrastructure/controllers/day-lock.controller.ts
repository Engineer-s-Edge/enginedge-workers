import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { DayLockService } from '../../application/services/day-lock.service';

/**
 * Day Lock Controller
 *
 * REST API endpoints for day locking
 *
 * Infrastructure Layer - HTTP adapter
 */
@ApiTags('Day Locking')
@Controller('scheduling/days')
export class DayLockController {
  private readonly logger = new Logger(DayLockController.name);

  constructor(private readonly dayLockService: DayLockService) {
    this.logger.log('DayLockController initialized');
  }

  /**
   * Lock or unlock a day
   */
  @Post(':date/lock')
  @ApiOperation({ summary: 'Lock or unlock a day' })
  @ApiParam({ name: 'date', description: 'Date in YYYY-MM-DD format' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['userId', 'locked'],
      properties: {
        userId: { type: 'string' },
        locked: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Day lock status updated' })
  async lockDay(
    @Param('date') date: string,
    @Body() body: { userId: string; locked: boolean },
  ) {
    this.logger.log(`${body.locked ? 'Locking' : 'Unlocking'} day: ${date}`);
    const dateObj = new Date(date);
    if (body.locked) {
      const result = await this.dayLockService.lockDay(body.userId, dateObj);
      return result;
    } else {
      const result = await this.dayLockService.unlockDay(body.userId, dateObj);
      return result;
    }
  }

  /**
   * Get locked days in date range
   */
  @Get('locked')
  @ApiOperation({ summary: 'Get locked days in date range' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  @ApiResponse({ status: 200, description: 'Locked days retrieved' })
  async getLockedDays(
    @Query('userId') userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    this.logger.log(`Getting locked days for user ${userId} from ${startDate} to ${endDate}`);
    const lockedDays = await this.dayLockService.getLockedDays(
      userId,
      new Date(startDate),
      new Date(endDate),
    );
    return { lockedDays };
  }
}
