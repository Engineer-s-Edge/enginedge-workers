import { Test, TestingModule } from '@nestjs/testing';
import { TimeSlotService } from '../time-slot.service';
import { TimeSlot } from '../../../domain/value-objects/time-slot.value-object';
import { CalendarEvent } from '../../../domain/entities/calendar-event.entity';

describe('TimeSlotService', () => {
  let service: TimeSlotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TimeSlotService],
    }).compile();

    service = module.get<TimeSlotService>(TimeSlotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAvailableSlots', () => {
    it('should find available slots with no events', () => {
      const startDate = new Date('2025-10-27T00:00:00Z');
      const endDate = new Date('2025-10-27T23:59:59Z');
      const events: CalendarEvent[] = [];

      const slots = service.findAvailableSlots(events, startDate, endDate);

      expect(slots).toBeDefined();
      expect(slots.length).toBeGreaterThan(0);
    });

    it('should exclude busy times from available slots', () => {
      const startDate = new Date('2025-10-27T09:00:00Z');
      const endDate = new Date('2025-10-27T17:00:00Z');

      const busyEvent = new CalendarEvent(
        'event1',
        'primary',
        'Meeting',
        new Date('2025-10-27T10:00:00Z'),
        new Date('2025-10-27T11:00:00Z'),
      );

      const slots = service.findAvailableSlots([busyEvent], startDate, endDate);

      // Verify no slots overlap with the busy time
      const overlapping = slots.filter((slot) =>
        slot.overlapsWith(new TimeSlot(busyEvent.startTime, busyEvent.endTime)),
      );

      expect(overlapping.length).toBe(0);
    });

    it('should apply buffer time between events', () => {
      const startDate = new Date('2025-10-27T09:00:00Z');
      const endDate = new Date('2025-10-27T17:00:00Z');

      const event = new CalendarEvent(
        'event1',
        'primary',
        'Meeting',
        new Date('2025-10-27T10:00:00Z'),
        new Date('2025-10-27T11:00:00Z'),
      );

      const slotsWithBuffer = service.findAvailableSlots(
        [event],
        startDate,
        endDate,
        { bufferMinutes: 15 },
      );

      // With 15 minute buffer, event blocks 9:45-11:15
      const bufferedSlot = new TimeSlot(
        new Date('2025-10-27T09:45:00Z'),
        new Date('2025-10-27T11:15:00Z'),
      );

      const overlapping = slotsWithBuffer.filter((slot) =>
        slot.overlapsWith(bufferedSlot),
      );

      expect(overlapping.length).toBe(0);
    });

    it('should respect working hours', () => {
      const startDate = new Date('2025-10-27T00:00:00Z');
      const endDate = new Date('2025-10-27T23:59:59Z');

      const slots = service.findAvailableSlots([], startDate, endDate, {
        workingHours: {
          startHour: 9,
          endHour: 17,
          daysOfWeek: [1, 2, 3, 4, 5],
        },
      });

      // All slots should be within 9am-5pm
      slots.forEach((slot) => {
        expect(slot.startTime.getHours()).toBeGreaterThanOrEqual(9);
        expect(slot.endTime.getHours()).toBeLessThanOrEqual(17);
      });
    });

    it('should filter slots by minimum duration', () => {
      const startDate = new Date('2025-10-27T09:00:00Z');
      const endDate = new Date('2025-10-27T17:00:00Z');

      const slots = service.findAvailableSlots([], startDate, endDate, {
        minSlotDuration: 60,
      });

      // All slots should be at least 60 minutes
      slots.forEach((slot) => {
        expect(slot.getDurationMinutes()).toBeGreaterThanOrEqual(60);
      });
    });

    it('should merge overlapping busy slots', () => {
      const startDate = new Date('2025-10-27T09:00:00Z');
      const endDate = new Date('2025-10-27T17:00:00Z');

      const event1 = new CalendarEvent(
        'event1',
        'primary',
        'Meeting 1',
        new Date('2025-10-27T10:00:00Z'),
        new Date('2025-10-27T11:00:00Z'),
      );

      const event2 = new CalendarEvent(
        'event2',
        'primary',
        'Meeting 2',
        new Date('2025-10-27T10:30:00Z'),
        new Date('2025-10-27T11:30:00Z'),
      );

      const slots = service.findAvailableSlots(
        [event1, event2],
        startDate,
        endDate,
      );

      // The two overlapping events should be treated as one busy period (10:00-11:30)
      const mergedBusySlot = new TimeSlot(
        new Date('2025-10-27T10:00:00Z'),
        new Date('2025-10-27T11:30:00Z'),
      );

      const overlapping = slots.filter((slot) =>
        slot.overlapsWith(mergedBusySlot),
      );

      expect(overlapping.length).toBe(0);
    });

    it('should exclude weekends by default', () => {
      const startDate = new Date('2025-10-25T00:00:00Z'); // Saturday
      const endDate = new Date('2025-10-27T23:59:59Z'); // Monday

      const slots = service.findAvailableSlots([], startDate, endDate);

      // Should only have Monday slots (day 1)
      slots.forEach((slot) => {
        const dayOfWeek = slot.startTime.getDay();
        expect(dayOfWeek).not.toBe(0); // Not Sunday
        expect(dayOfWeek).not.toBe(6); // Not Saturday
      });
    });

    it('should include weekends when requested', () => {
      const startDate = new Date('2025-10-25T00:00:00Z'); // Saturday
      const endDate = new Date('2025-10-26T23:59:59Z'); // Sunday

      const slots = service.findAvailableSlots([], startDate, endDate, {
        includeWeekends: true,
        workingHours: {
          startHour: 9,
          endHour: 17,
          daysOfWeek: [0, 6], // Weekend days
        },
      });

      expect(slots.length).toBeGreaterThan(0);
    });
  });

  describe('findNextAvailableSlot', () => {
    it('should find next slot for given duration', () => {
      const events: CalendarEvent[] = [];
      const startFrom = new Date('2025-10-27T09:00:00Z');

      const slot = service.findNextAvailableSlot(events, 60, startFrom);

      expect(slot).toBeDefined();
      expect(slot?.getDurationMinutes()).toBe(60);
    });

    it('should return null if no slot available', () => {
      // Fill up entire 30 day window
      const events: CalendarEvent[] = [];
      const startFrom = new Date('2025-10-27T09:00:00Z');

      for (let i = 0; i < 30; i++) {
        const dayStart = new Date(startFrom);
        dayStart.setDate(dayStart.getDate() + i);
        dayStart.setHours(0, 0, 0, 0);

        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        events.push(
          new CalendarEvent(
            `all-day-${i}`,
            'primary',
            'Blocked',
            dayStart,
            dayEnd,
          ),
        );
      }

      const slot = service.findNextAvailableSlot(events, 60, startFrom);

      expect(slot).toBeNull();
    });
  });

  describe('getTotalAvailableTime', () => {
    it('should calculate total available minutes', () => {
      const startDate = new Date('2025-10-27T09:00:00Z');
      const endDate = new Date('2025-10-27T17:00:00Z');
      const events: CalendarEvent[] = [];

      const totalMinutes = service.getTotalAvailableTime(
        events,
        startDate,
        endDate,
        {
          workingHours: {
            startHour: 9,
            endHour: 17,
            daysOfWeek: [1],
          },
        },
      );

      expect(totalMinutes).toBe(480); // 8 hours = 480 minutes
    });

    it('should subtract busy time from total', () => {
      const startDate = new Date('2025-10-27T09:00:00Z');
      const endDate = new Date('2025-10-27T17:00:00Z');

      const busyEvent = new CalendarEvent(
        'meeting',
        'primary',
        'Meeting',
        new Date('2025-10-27T10:00:00Z'),
        new Date('2025-10-27T11:00:00Z'),
      );

      const totalMinutes = service.getTotalAvailableTime(
        [busyEvent],
        startDate,
        endDate,
        {
          workingHours: {
            startHour: 9,
            endHour: 17,
            daysOfWeek: [1],
          },
        },
      );

      expect(totalMinutes).toBe(420); // 480 - 60 = 420 minutes
    });
  });

  describe('isSlotAvailable', () => {
    it('should return true for available slot', () => {
      const slot = new TimeSlot(
        new Date('2025-10-27T14:00:00Z'),
        new Date('2025-10-27T15:00:00Z'),
      );

      const events = [
        new CalendarEvent(
          'meeting',
          'primary',
          'Meeting',
          new Date('2025-10-27T10:00:00Z'),
          new Date('2025-10-27T11:00:00Z'),
        ),
      ];

      expect(service.isSlotAvailable(events, slot)).toBe(true);
    });

    it('should return false for conflicting slot', () => {
      const slot = new TimeSlot(
        new Date('2025-10-27T10:30:00Z'),
        new Date('2025-10-27T11:30:00Z'),
      );

      const events = [
        new CalendarEvent(
          'meeting',
          'primary',
          'Meeting',
          new Date('2025-10-27T10:00:00Z'),
          new Date('2025-10-27T11:00:00Z'),
        ),
      ];

      expect(service.isSlotAvailable(events, slot)).toBe(false);
    });
  });
});
