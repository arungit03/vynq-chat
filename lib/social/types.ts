import type { Timestamp } from "firebase/firestore";

export type SocialProfile = {
  uid: string;
  username: string;
  displayName: string;
  avatarPath: string | null;
  bio: string | null;
  createdAt?: Timestamp;
};

export type FollowRequestStatus = "pending" | "accepted" | "rejected" | "cancelled";

export type FollowRequest = {
  id: string;
  fromUid: string;
  toUid: string;
  status: FollowRequestStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  respondedAt?: Timestamp;
  profile?: SocialProfile | null;
};

export type SocialFriend = SocialProfile & {
  friendshipId: string;
};

export type RelationshipStatus = "self" | "friends" | "requested" | "incoming" | "none";

export type SocialSnapshot = {
  profile: SocialProfile | null;
  friends: SocialFriend[];
  followers: SocialProfile[];
  following: SocialProfile[];
  incomingRequests: FollowRequest[];
  outgoingRequests: FollowRequest[];
};
