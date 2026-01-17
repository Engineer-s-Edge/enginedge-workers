import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { HabitService } from '../../application/services/habit.service';
import {
  Habit,
  HabitFrequency,
  HabitPriority,
} from '../../domain/entities/habit.entity';

// DTOs for API documentation
class CreateHabitDto {
  userId!: string;
  title!: string;
  description?: string;
  frequency!: HabitFrequency;
  targetDays?: number[];
  targetTime?: string;
  durationMinutes?: number;
  priority?: HabitPriority;
  reminderMinutes?: number;
  color?: string;
  tags?: string[];
}

class UpdateHabitDto {
  title?: string;
  description?: string;
  frequency?: HabitFrequency;
  targetDays?: number[];
  targetTime?: string;
  durationMinutes?: number;
  priority?: HabitPriority;
  reminderMinutes?: number;
  color?: string;
  tags?: string[];
  isActive?: boolean;
}

class CompleteHabitDto {
  date?: Date;
  notes?: string;
}

class HabitStatsResponse {
  habitId!: string;
  totalCompletions!: number;
  completionRate!: number;
  currentStreak!: number;
  longestStreak!: number;
  lastCompletedAt?: Date;
}

@ApiTags('Habits')
@Controller('habits')
export class HabitController {
  private readonly logger = new Logger(HabitController.name);

  constructor(private readonly habitService: HabitService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new habit' })
  @ApiResponse({
    status: 201,
    description: 'Habit created successfully',
    type: Habit,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async createHabit(@Body() dto: CreateHabitDto): Promise<Habit> {
    this.logger.log(`Creating habit: ${dto.title} for user ${dto.userId}`);

    return this.habitService.createHabit({
      userId: dto.userId,
      name: dto.title,
      description: dto.description,
      frequency: dto.frequency,
      priority: dto.priority || 3,
      estimatedDurationMinutes: dto.durationMinutes || 30,
      preferredTimeOfDay: 'anytime',
      metadata: {
        targetDays: dto.targetDays,
        targetTime: dto.targetTime,
        reminderMinutes: dto.reminderMinutes,
        color: dto.color,
        tags: dto.tags,
      },
    });
  }

  @Get()
  @ApiOperation({ summary: 'Get all habits for a user' })
  @ApiQuery({ name: 'userId', required: true, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: 'List of habits',
    type: [Habit],
  })
  async getHabits(
    @Query('userId') userId: string,
    @Query('isActive') isActive?: boolean,
  ): Promise<Habit[]> {
    this.logger.log(`Fetching habits for user ${userId}, active: ${isActive}`);

    if (isActive !== undefined) {
      return this.habitService.getActiveHabits(userId);
    }

    // If no repository method exists for all habits, filter from active
    return this.habitService.getActiveHabits(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific habit by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: 200,
    description: 'Habit details',
    type: Habit,
  })
  @ApiResponse({ status: 404, description: 'Habit not found' })
  async getHabit(@Param('id') id: string): Promise<Habit> {
    this.logger.log(`Fetching habit ${id}`);

    const habit = await this.habitService.getHabit(id);
    if (!habit) {
      throw new Error(`Habit ${id} not found`);
    }
    return habit;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a habit' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: 200,
    description: 'Habit updated successfully',
    type: Habit,
  })
  @ApiResponse({ status: 404, description: 'Habit not found' })
  async updateHabit(
    @Param('id') id: string,
    @Body() dto: UpdateHabitDto,
  ): Promise<Habit> {
    this.logger.log(`Updating habit ${id}`);

    return this.habitService.updateHabit(id, {
      name: dto.title,
      description: dto.description,
      frequency: dto.frequency,
      priority: dto.priority,
      estimatedDurationMinutes: dto.durationMinutes,
      preferredTimeOfDay: dto.targetTime
        ? dto.targetTime.includes('morning')
          ? 'morning'
          : dto.targetTime.includes('evening')
            ? 'evening'
            : 'afternoon'
        : undefined,
      isActive: dto.isActive,
      metadata: {
        targetDays: dto.targetDays,
        targetTime: dto.targetTime,
        reminderMinutes: dto.reminderMinutes,
        color: dto.color,
        tags: dto.tags,
      },
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a habit' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204, description: 'Habit deleted successfully' })
  @ApiResponse({ status: 404, description: 'Habit not found' })
  async deleteHabit(@Param('id') id: string): Promise<void> {
    this.logger.log(`Deleting habit ${id}`);

    await this.habitService.deleteHabit(id);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Mark a habit as completed for a specific date' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: 200,
    description: 'Habit marked as complete',
    type: Habit,
  })
  @ApiResponse({ status: 404, description: 'Habit not found' })
  async completeHabit(
    @Param('id') id: string,
    @Body() dto: CompleteHabitDto,
  ): Promise<Habit> {
    this.logger.log(
      `Completing habit ${id} for date ${dto.date || new Date()}`,
    );

    return this.habitService.completeHabit(id, dto.notes);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get statistics for a habit' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: 200,
    description: 'Habit statistics',
    type: HabitStatsResponse,
  })
  @ApiResponse({ status: 404, description: 'Habit not found' })
  async getHabitStats(@Param('id') id: string): Promise<HabitStatsResponse> {
    this.logger.log(`Fetching stats for habit ${id}`);

    const stats = await this.habitService.getHabitStats(id);
    const habit = await this.habitService.getHabit(id);

    if (!habit) {
      throw new Error(`Habit ${id} not found`);
    }

    return {
      habitId: id,
      totalCompletions: habit.completions?.length || 0,
      completionRate: stats.completionRate30Days,
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
      lastCompletedAt:
        habit.completions && habit.completions.length > 0
          ? habit.completions[habit.completions.length - 1].date
          : undefined,
    };
  }

  @Get('user/:userId/unmet')
  @ApiOperation({ summary: 'Get unmet habits for a specific date' })
  @ApiParam({ name: 'userId', type: String })
  @ApiQuery({ name: 'date', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'List of unmet habits',
    type: [Habit],
  })
  async getUnmetHabits(
    @Param('userId') userId: string,
    @Query('date') dateStr?: string,
  ): Promise<Habit[]> {
    const date = dateStr ? new Date(dateStr) : new Date();
    this.logger.log(
      `Fetching unmet habits for user ${userId} on ${date.toISOString()}`,
    );

    return this.habitService.getUnmetHabits(userId);
  }

  @Get('user/:userId/due-today')
  @ApiOperation({ summary: 'Get habits due today for a user' })
  @ApiParam({ name: 'userId', type: String })
  @ApiResponse({
    status: 200,
    description: 'List of habits due today',
    type: [Habit],
  })
  async getHabitsDueToday(@Param('userId') userId: string): Promise<Habit[]> {
    this.logger.log(`Fetching habits due today for user ${userId}`);

    const habits = await this.habitService.getActiveHabits(userId);
    return habits.filter((habit) => habit.isDueToday());
  }
}
