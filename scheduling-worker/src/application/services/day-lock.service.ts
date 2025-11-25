import { Injectable, Logger, Inject } from '@nestjs/common';
import { MongoDayLockRepository } from '../../infrastructure/adapters/persistence/mongo-day-lock.repository';
import { ITaskRepository } from '../ports/repositories.port';

/**
 * Day Lock Service
 *
 * Business logic for day locking
 *
 * Application Layer - Orchestrates domain logic
 */
@Injectable()
export class DayLockService {
  private readonly logger = new Logger(DayLockService.name);

  constructor(
    private readonly dayLockRepository: MongoDayLockRepository,
    @Inject('ITaskRepository')
    private readonly taskRepository: ITaskRepository,
  ) {
    this.logger.log('DayLockService initialized');
  }

  /**
   * Lock a day
   */
  async lockDay(
    userId: string,
    date: Date,
  ): Promise<{
    date: string;
    isLocked: boolean;
    lockedAt: Date;
    lockedTasks: string[];
  }> {
    this.logger.log(
      `Locking day ${date.toISOString().split('T')[0]} for user ${userId}`,
    );

    await this.dayLockRepository.lockDay(userId, date);

    // Get tasks on this day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const tasks = await this.taskRepository.findByDateRange(
      startOfDay,
      endOfDay,
      userId,
    );
    const taskIds = tasks.map((t) => t.id);

    return {
      date: date.toISOString().split('T')[0],
      isLocked: true,
      lockedAt: new Date(),
      lockedTasks: taskIds,
    };
  }

  /**
   * Unlock a day
   */
  async unlockDay(
    userId: string,
    date: Date,
  ): Promise<{
    date: string;
    isLocked: boolean;
  }> {
    this.logger.log(
      `Unlocking day ${date.toISOString().split('T')[0]} for user ${userId}`,
    );

    await this.dayLockRepository.unlockDay(userId, date);

    return {
      date: date.toISOString().split('T')[0],
      isLocked: false,
    };
  }

  /**
   * Check if a day is locked
   */
  async isDayLocked(userId: string, date: Date): Promise<boolean> {
    return await this.dayLockRepository.isDayLocked(userId, date);
  }

  /**
   * Get locked days in a date range
   */
  async getLockedDays(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<
    Array<{
      date: string;
      isLocked: boolean;
      lockedAt: Date;
    }>
  > {
    const lockedDays = await this.dayLockRepository.getLockedDaysWithMetadata(
      userId,
      startDate,
      endDate,
    );
    return lockedDays.map((ld) => ({
      date: ld.date.toISOString().split('T')[0],
      isLocked: true,
      lockedAt: ld.lockedAt,
    }));
  }
}
