export type WaitlistMembershipStatus =
  | 'joined'
  | 'waitlisted'
  | 'pending_confirm'
  | 'waitlisted_passed'
  | 'left';

export type WaitlistMembership = {
  profileId: string;
  status: WaitlistMembershipStatus;
  createdAt?: string;
};

export type WaitlistSyncPlan = {
  availableSpots: number;
  promoteToPendingIds: string[];
  resetToWaitlistedIds: string[];
};

function sortMemberships(memberships: WaitlistMembership[]) {
  return [...memberships].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
}

export function buildWaitlistSyncPlan(
  memberships: WaitlistMembership[],
  maxPlayers: number,
): WaitlistSyncPlan {
  const sorted = sortMemberships(memberships);
  const joined = sorted.filter((membership) => membership.status === 'joined');
  const availableSpots = Math.max(0, maxPlayers - joined.length);

  if (availableSpots === 0) {
    return {
      availableSpots,
      promoteToPendingIds: [],
      resetToWaitlistedIds: sorted
        .filter((membership) => membership.status === 'pending_confirm' || membership.status === 'waitlisted_passed')
        .map((membership) => membership.profileId),
    };
  }

  const pending = sorted.filter((membership) => membership.status === 'pending_confirm');
  const waitlisted = sorted.filter((membership) => membership.status === 'waitlisted');
  const keptPending = pending.slice(0, availableSpots);
  const overflowPending = pending.slice(availableSpots);
  const missingPendingCount = Math.max(0, availableSpots - keptPending.length);
  const promoteToPendingIds = waitlisted.slice(0, missingPendingCount).map((membership) => membership.profileId);

  return {
    availableSpots,
    promoteToPendingIds,
    resetToWaitlistedIds: overflowPending.map((membership) => membership.profileId),
  };
}
