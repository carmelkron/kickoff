import { describe, expect, it } from 'vitest';
import { buildWaitlistSyncPlan, type WaitlistMembership } from './waitlist';

function membership(
  profileId: string,
  status: WaitlistMembership['status'],
  createdAt: string,
): WaitlistMembership {
  return { profileId, status, createdAt };
}

describe('buildWaitlistSyncPlan', () => {
  it('promotes the first waitlisted player when a spot opens', () => {
    const plan = buildWaitlistSyncPlan(
      [
        membership('joined-1', 'joined', '2026-04-17T10:00:00.000Z'),
        membership('joined-2', 'joined', '2026-04-17T10:01:00.000Z'),
        membership('wait-1', 'waitlisted', '2026-04-17T10:02:00.000Z'),
        membership('wait-2', 'waitlisted', '2026-04-17T10:03:00.000Z'),
      ],
      3,
    );

    expect(plan).toEqual({
      availableSpots: 1,
      promoteToPendingIds: ['wait-1'],
      resetToWaitlistedIds: [],
    });
  });

  it('skips passed players and promotes the next player when multiple spots are open', () => {
    const plan = buildWaitlistSyncPlan(
      [
        membership('joined-1', 'joined', '2026-04-17T10:00:00.000Z'),
        membership('pass-1', 'waitlisted_passed', '2026-04-17T10:01:00.000Z'),
        membership('pending-1', 'pending_confirm', '2026-04-17T10:02:00.000Z'),
        membership('wait-1', 'waitlisted', '2026-04-17T10:03:00.000Z'),
        membership('wait-2', 'waitlisted', '2026-04-17T10:04:00.000Z'),
      ],
      3,
    );

    expect(plan).toEqual({
      availableSpots: 2,
      promoteToPendingIds: ['wait-1'],
      resetToWaitlistedIds: [],
    });
  });

  it('resets pending and passed players once the lobby is full again', () => {
    const plan = buildWaitlistSyncPlan(
      [
        membership('joined-1', 'joined', '2026-04-17T10:00:00.000Z'),
        membership('joined-2', 'joined', '2026-04-17T10:01:00.000Z'),
        membership('pending-1', 'pending_confirm', '2026-04-17T10:02:00.000Z'),
        membership('pass-1', 'waitlisted_passed', '2026-04-17T10:03:00.000Z'),
      ],
      2,
    );

    expect(plan).toEqual({
      availableSpots: 0,
      promoteToPendingIds: [],
      resetToWaitlistedIds: ['pending-1', 'pass-1'],
    });
  });

  it('demotes overflow pending players if there are fewer spots than pending confirmations', () => {
    const plan = buildWaitlistSyncPlan(
      [
        membership('joined-1', 'joined', '2026-04-17T10:00:00.000Z'),
        membership('pending-1', 'pending_confirm', '2026-04-17T10:01:00.000Z'),
        membership('pending-2', 'pending_confirm', '2026-04-17T10:02:00.000Z'),
        membership('wait-1', 'waitlisted', '2026-04-17T10:03:00.000Z'),
      ],
      2,
    );

    expect(plan).toEqual({
      availableSpots: 1,
      promoteToPendingIds: [],
      resetToWaitlistedIds: ['pending-2'],
    });
  });
});
