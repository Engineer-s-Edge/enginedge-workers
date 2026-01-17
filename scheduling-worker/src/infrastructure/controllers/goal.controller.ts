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
import { GoalService } from '../../application/services/goal.service';
import {
  Goal,
  GoalStatus,
  GoalPriority,
  Milestone,
} from '../../domain/entities/goal.entity';

// DTOs for API documentation
class CreateGoalDto {
  userId!: string;
  title!: string;
  description?: string;
  targetDate!: Date;
  priority?: GoalPriority;
  estimatedHours?: number;
  category?: string;
  tags?: string[];
  dependsOn?: string[];
  milestones?: Omit<Milestone, 'id' | 'completedAt'>[];
}

class UpdateGoalDto {
  title?: string;
  description?: string;
  targetDate?: Date;
  priority?: GoalPriority;
  estimatedHours?: number;
  category?: string;
  tags?: string[];
  dependsOn?: string[];
  status?: GoalStatus;
}

class UpdateProgressDto {
  progress!: number;
  notes?: string;
}

class AddMilestoneDto {
  title!: string;
  targetDate!: Date;
  description?: string;
}

class CompleteMilestoneDto {
  notes?: string;
}

class LogTimeDto {
  hours!: number;
  description?: string;
}

class GoalProgressResponse {
  goalId!: string;
  progress!: number;
  status!: GoalStatus;
  timeSpent!: number;
  estimatedHours?: number;
  remainingHours?: number;
  completedMilestones!: number;
  totalMilestones!: number;
  daysUntilDeadline?: number;
  isOverdue!: boolean;
  isDueSoon!: boolean;
}

@ApiTags('Goals')
@Controller('goals')
export class GoalController {
  private readonly logger = new Logger(GoalController.name);

  constructor(private readonly goalService: GoalService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new goal' })
  @ApiResponse({
    status: 201,
    description: 'Goal created successfully',
    type: Goal,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async createGoal(@Body() dto: CreateGoalDto): Promise<Goal> {
    this.logger.log(`Creating goal: ${dto.title} for user ${dto.userId}`);

    // Create the goal via service (which handles entity instantiation properly)
    const goal = await this.goalService.createGoal({
      userId: dto.userId,
      title: dto.title,
      description: dto.description,
      priority: dto.priority || 3,
      targetDate: dto.targetDate,
      estimatedTimeRequired: dto.estimatedHours || 0,
      dependsOn: dto.dependsOn,
      metadata: {
        category: dto.category,
        tags: dto.tags,
        milestones: dto.milestones,
      },
    });

    return goal;
  }

  @Get()
  @ApiOperation({ summary: 'Get all goals for a user' })
  @ApiQuery({ name: 'userId', required: true, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'List of goals',
    type: [Goal],
  })
  async getGoals(
    @Query('userId') userId: string,
    @Query('status') status?: GoalStatus,
  ): Promise<Goal[]> {
    this.logger.log(`Fetching goals for user ${userId}, status: ${status}`);

    const goals = await this.goalService.getUserGoals(userId);

    if (status) {
      return goals.filter((g) => g.status === status);
    }

    return goals;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific goal by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: 200,
    description: 'Goal details',
    type: Goal,
  })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  async getGoal(@Param('id') id: string): Promise<Goal> {
    this.logger.log(`Fetching goal ${id}`);

    const goal = await this.goalService.getGoal(id);
    if (!goal) {
      throw new Error(`Goal ${id} not found`);
    }
    return goal;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a goal' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: 200,
    description: 'Goal updated successfully',
    type: Goal,
  })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  async updateGoal(
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
  ): Promise<Goal> {
    this.logger.log(`Updating goal ${id}`);

    return this.goalService.updateGoal(id, {
      title: dto.title,
      description: dto.description,
      targetDate: dto.targetDate,
      priority: dto.priority,
      estimatedTimeRequired: dto.estimatedHours,
      status: dto.status,
      dependsOn: dto.dependsOn,
      metadata: {
        category: dto.category,
        tags: dto.tags,
      },
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a goal' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204, description: 'Goal deleted successfully' })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  async deleteGoal(@Param('id') id: string): Promise<void> {
    this.logger.log(`Deleting goal ${id}`);

    await this.goalService.deleteGoal(id);
  }

  @Post(':id/progress')
  @ApiOperation({ summary: 'Update goal progress' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: 200,
    description: 'Progress updated successfully',
    type: Goal,
  })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  async updateProgress(
    @Param('id') id: string,
    @Body() dto: UpdateProgressDto,
  ): Promise<Goal> {
    this.logger.log(`Updating progress for goal ${id} to ${dto.progress}%`);

    return this.goalService.updateProgress(id, dto.progress, dto.notes);
  }

  @Post(':id/milestones')
  @ApiOperation({ summary: 'Add a milestone to a goal' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: 201,
    description: 'Milestone added successfully',
    type: Goal,
  })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  async addMilestone(
    @Param('id') id: string,
    @Body() dto: AddMilestoneDto,
  ): Promise<Goal> {
    this.logger.log(`Adding milestone to goal ${id}: ${dto.title}`);

    const milestone: Milestone = {
      id: `milestone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: dto.title,
      description: dto.description,
      targetDate: dto.targetDate,
      completed: false,
    };

    return this.goalService.updateMilestone(id, milestone);
  }

  @Post(':goalId/milestones/:milestoneId/complete')
  @ApiOperation({ summary: 'Complete a milestone' })
  @ApiParam({ name: 'goalId', type: String })
  @ApiParam({ name: 'milestoneId', type: String })
  @ApiResponse({
    status: 200,
    description: 'Milestone completed successfully',
    type: Goal,
  })
  @ApiResponse({ status: 404, description: 'Goal or milestone not found' })
  async completeMilestone(
    @Param('goalId') goalId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: CompleteMilestoneDto,
  ): Promise<Goal> {
    this.logger.log(
      `Completing milestone ${milestoneId} for goal ${goalId}${dto.notes ? ` with notes: ${dto.notes}` : ''}`,
    );

    return this.goalService.completeMilestone(goalId, milestoneId);
  }

  @Post(':id/time')
  @ApiOperation({ summary: 'Log time spent on a goal' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: 200,
    description: 'Time logged successfully',
    type: Goal,
  })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  async logTime(
    @Param('id') id: string,
    @Body() dto: LogTimeDto,
  ): Promise<Goal> {
    this.logger.log(`Logging ${dto.hours} hours for goal ${id}`);

    const minutes = dto.hours * 60;
    // TODO: Implement logTime method in GoalService
    throw new Error('logTime not implemented');
    // return this.goalService.logTime(id, minutes, dto.description);
  }

  @Get(':id/progress-summary')
  @ApiOperation({ summary: 'Get progress summary for a goal' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: 200,
    description: 'Goal progress summary',
    type: GoalProgressResponse,
  })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  async getProgressSummary(
    @Param('id') id: string,
  ): Promise<GoalProgressResponse> {
    this.logger.log(`Fetching progress summary for goal ${id}`);

    const goal = await this.goalService.getGoal(id);
    if (!goal) {
      throw new Error(`Goal ${id} not found`);
    }

    const stats = await this.goalService.getGoalStats(id);
    const daysUntilDeadline = goal.targetDate
      ? Math.ceil(
          (goal.targetDate.getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : undefined;

    return {
      goalId: goal.id,
      progress: goal.progressPercentage,
      status: goal.status,
      timeSpent: goal.timeSpent,
      estimatedHours: goal.estimatedTimeRequired
        ? goal.estimatedTimeRequired / 60
        : undefined,
      remainingHours: stats.remainingTimeEstimate
        ? stats.remainingTimeEstimate / 60
        : undefined,
      completedMilestones: goal.milestones.filter((m) => m.completed).length,
      totalMilestones: goal.milestones.length,
      daysUntilDeadline,
      isOverdue: stats.isOverdue,
      isDueSoon: stats.isDueSoon,
    };
  }

  @Get('user/:userId/overdue')
  @ApiOperation({ summary: 'Get overdue goals for a user' })
  @ApiParam({ name: 'userId', type: String })
  @ApiResponse({
    status: 200,
    description: 'List of overdue goals',
    type: [Goal],
  })
  async getOverdueGoals(@Param('userId') userId: string): Promise<Goal[]> {
    this.logger.log(`Fetching overdue goals for user ${userId}`);

    return this.goalService.getOverdueGoals(userId);
  }

  @Get('user/:userId/due-soon')
  @ApiOperation({ summary: 'Get goals due soon for a user' })
  @ApiParam({ name: 'userId', type: String })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days ahead to look (default: 7)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of goals due soon',
    type: [Goal],
  })
  async getGoalsDueSoon(
    @Param('userId') userId: string,
    @Query('days') days: number = 7,
  ): Promise<Goal[]> {
    this.logger.log(
      `Fetching goals due within ${days} days for user ${userId}`,
    );

    const allGoals = await this.goalService.getActiveGoals(userId);
    return allGoals.filter((goal) => goal.isDueSoon(days));
  }

  @Get('user/:userId/by-priority')
  @ApiOperation({ summary: 'Get goals sorted by priority' })
  @ApiParam({ name: 'userId', type: String })
  @ApiResponse({
    status: 200,
    description: 'List of goals sorted by priority (high to low)',
    type: [Goal],
  })
  async getGoalsByPriority(@Param('userId') userId: string): Promise<Goal[]> {
    this.logger.log(`Fetching goals by priority for user ${userId}`);

    const goals = await this.goalService.getActiveGoals(userId);

    // Sort by priority (5 = highest, 1 = lowest)
    return goals.sort((a, b) => b.priority - a.priority);
  }
}
