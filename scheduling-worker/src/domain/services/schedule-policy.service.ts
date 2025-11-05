import { Injectable } from '@nestjs/common';

@Injectable()
export class SchedulePolicyService {
  canAutoSchedule(durationMinutes: number, isWorkingHours: boolean): boolean {
    if (!isWorkingHours) return false;
    return durationMinutes <= 60;
  }
}
