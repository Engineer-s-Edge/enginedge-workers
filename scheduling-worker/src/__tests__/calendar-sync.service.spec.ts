/* eslint-disable @typescript-eslint/no-explicit-any */
import { CalendarSyncService, ConflictResolutionStrategy } from '../infrastructure/adapters/sync/calendar-sync.service';
import { CalendarEvent } from '../domain/entities/calendar-event.entity';

describe('CalendarSyncService', () => {
  let svc: CalendarSyncService;
  const mockCalendarApi: any = {
    listEvents: jest.fn(),
    updateEvent: jest.fn(),
    createEvent: jest.fn(),
  };

  const mockEventRepo: any = {
    findById: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    findByUserId: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new CalendarSyncService(mockCalendarApi, mockEventRepo);
  });

  test('fullSync should pull remote events and save new events locally', async () => {
    const now = new Date();
    const remoteEvent = new CalendarEvent(
      'r1',
      'primary',
      'Meeting',
      null,
      new Date(now.getTime() + 1000 * 60 * 60),
      new Date(now.getTime() + 1000 * 60 * 60 * 2),
      null,
      [],
      [],
      null,
      now,
      now,
    );

    mockCalendarApi.listEvents.mockResolvedValue([remoteEvent]);
    mockEventRepo.findById.mockResolvedValue(null);
    mockEventRepo.findByUserId.mockResolvedValue([]);

    await svc.fullSync('user1', 'primary');

    expect(mockCalendarApi.listEvents).toHaveBeenCalledWith('primary', expect.any(Object));
    expect(mockEventRepo.save).toHaveBeenCalledWith(remoteEvent);
  });

  test('incrementalSync should fall back to fullSync when no token available', async () => {
    mockCalendarApi.listEvents.mockResolvedValue([]);
    mockEventRepo.findByUserId.mockResolvedValue([]);

    await svc.incrementalSync('user2', 'primary');

    expect(mockCalendarApi.listEvents).toHaveBeenCalled();
  });

  test('resolveConflict with LAST_WRITE_WINS picks the most recent update', () => {
    const t1 = new Date(Date.now() - 10000);
    const t2 = new Date(Date.now());

    // local is newer: start before end, created/updated accordingly
    const local = new CalendarEvent('e1', 'primary', 'Local', null, t1, t2, null, [], [], null, t1, t2);
    // remote is older
    const remote = new CalendarEvent('e1', 'primary', 'Remote', null, new Date(t1.getTime() - 20000), new Date(t1.getTime() - 10000), null, [], [], null, new Date(t1.getTime() - 20000), new Date(t1.getTime() - 10000));

    const chosen = svc.resolveConflict(local, remote, ConflictResolutionStrategy.LAST_WRITE_WINS);
    expect(chosen).toBe(local);
  });

  test('getSyncState returns non-null after fullSync', async () => {
    mockCalendarApi.listEvents.mockResolvedValue([]);
    mockEventRepo.findByUserId.mockResolvedValue([]);

    await svc.fullSync('user3', 'primary');
    const state = await svc.getSyncState('user3', 'primary');

    expect(state).not.toBeNull();
    if (state) {
      expect(state.userId).toBe('user3');
      expect(state.calendarId).toBe('primary');
    }
  });
});
