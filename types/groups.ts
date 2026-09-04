// Shared runtime shapes for private groups. Fields mirror what the group
// services and hooks actually produce/consume (groupApi.js
// normalizeGroupsPayload, groupCategoriesStore.js normalizePrivateCategory,
// groupMembershipApi.js listMembers, hooks/useActiveGroup.js). Rows come from
// axios JSON, so optional fields + index signatures keep the boundary honest.

export type GroupRole = 'owner' | 'member';

export type GroupHomeBackgroundSlotData = {
  image_id?: string | null;
  file_extension?: string | null;
  url?: string | null;
};

export type Group = {
  id: string;
  name?: string | null;
  role?: GroupRole;
  primary_color?: string | null;
  secondary_color?: string | null;
  member_count?: number | null;
  locked?: boolean | null;
  owner_id?: string | null;
  joining_code?: string | null;
  home_button_backgrounds?: {
    hide?: GroupHomeBackgroundSlotData | null;
    find?: GroupHomeBackgroundSlotData | null;
    ranking?: GroupHomeBackgroundSlotData | null;
  } | null;
  [key: string]: unknown;
};

export type GroupsHubData = {
  owned?: Group[];
  joined?: Group[];
  pendingInvites?: unknown[];
};

// Private-group screen routing scope (hooks/useActiveGroup.js and the
// `scope` route param). The optional-undefined on `public` keeps `scope?.groupId`
// honest at every access site without a discriminant dance.
export type GroupScope =
  | { kind: 'private'; groupId: string }
  | { kind: 'public'; groupId?: undefined };

export type PrivateGroupCategory = {
  id: string;
  key?: string | null;
  name?: string | null;
  sort_order?: number | null;
  thumbnail_image_id?: string | null;
  thumbnail_url?: string | null;
  thumbnailUrl?: string | null;
  [key: string]: unknown;
};

export type GroupMember = {
  id: string;
  user_id?: string | null;
  userId?: string | null;
  username?: string | null;
  role?: GroupRole;
  [key: string]: unknown;
};
