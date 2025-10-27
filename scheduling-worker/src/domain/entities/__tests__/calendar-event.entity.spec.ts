import { describe, it, expect, beforeEach } from '@jest/globals';
import { CalendarEvent } from '../calendar-event.entity';

describe('CalendarEvent Entity', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let validEventData: any;

  beforeEach(() => {
    validEventData = {
      id: 'event_123',
      calendarId: 'primary',
      title: 'Team Meeting',
      description: 'Weekly sync',
      startTime: new Date('2025-01-15T10:00:00Z'),
      endTime: new Date('2025-01-15T11:00:00Z'),
      location: 'Conference Room A',
      attendees: [
        { email: 'user@example.com', responseStatus: 'accepted' as const },
      ],
      reminders: [{ method: 'popup' as const, minutes: 10 }],
      recurrence: null,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-01T00:00:00Z'),
      source: 'google' as const,
    };
  });

  describe('constructor', () => {
    it('should create a valid calendar event', () => {
      const event = new CalendarEvent(
        validEventData.id,
        validEventData.calendarId,
        validEventData.title,
        validEventData.description,
        validEventData.startTime,
        validEventData.endTime,
        validEventData.location,
        validEventData.attendees,
        validEventData.reminders,
        validEventData.recurrence,
        validEventData.createdAt,
        validEventData.updatedAt,
        validEventData.source,
      );

      expect(event.id).toBe('event_123');
      expect(event.title).toBe('Team Meeting');
      expect(event.getDurationMinutes()).toBe(60);
    });

    it('should throw error if ID is missing', () => {
      expect(() => {
        new CalendarEvent(
          '',
          validEventData.calendarId,
          validEventData.title,
          validEventData.description,
          validEventData.startTime,
          validEventData.endTime,
          validEventData.location,
          validEventData.attendees,
          validEventData.reminders,
          validEventData.recurrence,
          validEventData.createdAt,
          validEventData.updatedAt,
        );
      }).toThrow('Event ID is required');
    });

    it('should throw error if title is empty', () => {
      expect(() => {
        new CalendarEvent(
          validEventData.id,
          validEventData.calendarId,
          '',
          validEventData.description,
          validEventData.startTime,
          validEventData.endTime,
          validEventData.location,
          validEventData.attendees,
          validEventData.reminders,
          validEventData.recurrence,
          validEventData.createdAt,
          validEventData.updatedAt,
        );
      }).toThrow('Event title is required');
    });

    it('should throw error if end time is before start time', () => {
      expect(() => {
        new CalendarEvent(
          validEventData.id,
          validEventData.calendarId,
          validEventData.title,
          validEventData.description,
          new Date('2025-01-15T11:00:00Z'),
          new Date('2025-01-15T10:00:00Z'),
          validEventData.location,
          validEventData.attendees,
          validEventData.reminders,
          validEventData.recurrence,
          validEventData.createdAt,
          validEventData.updatedAt,
        );
      }).toThrow('Event end time must be after start time');
    });
  });

  describe('getDurationMinutes', () => {
    it('should calculate duration correctly', () => {
      const event = new CalendarEvent(
        validEventData.id,
        validEventData.calendarId,
        validEventData.title,
        validEventData.description,
        new Date('2025-01-15T10:00:00Z'),
        new Date('2025-01-15T12:30:00Z'),
        validEventData.location,
        validEventData.attendees,
        validEventData.reminders,
        validEventData.recurrence,
        validEventData.createdAt,
        validEventData.updatedAt,
      );

      expect(event.getDurationMinutes()).toBe(150);
    });
  });

  describe('overlapsWith', () => {
    it('should detect overlapping events', () => {
      const event1 = new CalendarEvent(
        'event_1',
        'primary',
        'Event 1',
        null,
        new Date('2025-01-15T10:00:00Z'),
        new Date('2025-01-15T11:00:00Z'),
        null,
        [],
        [],
        null,
        new Date(),
        new Date(),
      );

      const event2 = new CalendarEvent(
        'event_2',
        'primary',
        'Event 2',
        null,
        new Date('2025-01-15T10:30:00Z'),
        new Date('2025-01-15T11:30:00Z'),
        null,
        [],
        [],
        null,
        new Date(),
        new Date(),
      );

      expect(event1.overlapsWith(event2)).toBe(true);
      expect(event2.overlapsWith(event1)).toBe(true);
    });

    it('should not detect non-overlapping events', () => {
      const event1 = new CalendarEvent(
        'event_1',
        'primary',
        'Event 1',
        null,
        new Date('2025-01-15T10:00:00Z'),
        new Date('2025-01-15T11:00:00Z'),
        null,
        [],
        [],
        null,
        new Date(),
        new Date(),
      );

      const event2 = new CalendarEvent(
        'event_2',
        'primary',
        'Event 2',
        null,
        new Date('2025-01-15T11:00:00Z'),
        new Date('2025-01-15T12:00:00Z'),
        null,
        [],
        [],
        null,
        new Date(),
        new Date(),
      );

      expect(event1.overlapsWith(event2)).toBe(false);
    });
  });

  describe('isAllDay', () => {
    it('should detect all-day events', () => {
      const event = new CalendarEvent(
        'event_1',
        'primary',
        'All Day Event',
        null,
        new Date('2025-01-15T00:00:00Z'),
        new Date('2025-01-16T00:00:00Z'),
        null,
        [],
        [],
        null,
        new Date(),
        new Date(),
      );

      expect(event.isAllDay()).toBe(true);
    });

    it('should not detect non-all-day events', () => {
      const event = new CalendarEvent(
        'event_1',
        'primary',
        'Regular Event',
        null,
        new Date('2025-01-15T10:00:00Z'),
        new Date('2025-01-15T11:00:00Z'),
        null,
        [],
        [],
        null,
        new Date(),
        new Date(),
      );

      expect(event.isAllDay()).toBe(false);
    });
  });

  describe('update', () => {
    it('should update event properties', () => {
      const event = new CalendarEvent(
        validEventData.id,
        validEventData.calendarId,
        validEventData.title,
        validEventData.description,
        validEventData.startTime,
        validEventData.endTime,
        validEventData.location,
        validEventData.attendees,
        validEventData.reminders,
        validEventData.recurrence,
        validEventData.createdAt,
        validEventData.updatedAt,
      );

      const updated = event.update({
        title: 'Updated Meeting',
        description: 'New description',
      });

      expect(updated.title).toBe('Updated Meeting');
      expect(updated.description).toBe('New description');
      expect(updated.id).toBe(validEventData.id);
    });
  });

  describe('toObject and fromObject', () => {
    it('should serialize and deserialize correctly', () => {
      const event = new CalendarEvent(
        validEventData.id,
        validEventData.calendarId,
        validEventData.title,
        validEventData.description,
        validEventData.startTime,
        validEventData.endTime,
        validEventData.location,
        validEventData.attendees,
        validEventData.reminders,
        validEventData.recurrence,
        validEventData.createdAt,
        validEventData.updatedAt,
      );

      const obj = event.toObject();
      const deserialized = CalendarEvent.fromObject(obj);

      expect(deserialized.id).toBe(event.id);
      expect(deserialized.title).toBe(event.title);
      expect(deserialized.startTime.getTime()).toBe(event.startTime.getTime());
    });
  });
});
