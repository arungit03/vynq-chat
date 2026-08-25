export type Message = {
  id: string;
  sender: "me" | "them";
  type: "text" | "image" | "video";
  text?: string;
  time: string;
  read?: boolean;
  accent?: string;
};

export type Conversation = {
  id: string;
  peerUid?: string;
  name: string;
  handle: string;
  initials: string;
  avatar: string;
  online: boolean;
  lastMessage: string;
  lastTime: string;
  unread?: number;
  expiry: string;
  messages: Message[];
};

export const conversations: Conversation[] = [
  {
    id: "mira",
    name: "Mira Chen",
    handle: "@mirachen",
    initials: "MC",
    avatar: "linear-gradient(135deg, #f5b7a9 5%, #ba83e8 92%)",
    online: true,
    lastMessage: "The light is perfect today ✨",
    lastTime: "10:42",
    unread: 2,
    expiry: "23h 18m",
    messages: [
      {
        id: "m1",
        sender: "them",
        type: "text",
        text: "Found a quiet little corner for the shoot.",
        time: "10:36",
      },
      {
        id: "m2",
        sender: "me",
        type: "text",
        text: "That looks like exactly our kind of quiet.",
        time: "10:39",
        read: true,
      },
      {
        id: "m3",
        sender: "them",
        type: "image",
        time: "10:40",
        accent: "linear-gradient(140deg, #d4edff 0%, #a7c3e9 45%, #edc09f 100%)",
      },
      {
        id: "m4",
        sender: "them",
        type: "text",
        text: "The light is perfect today ✨",
        time: "10:42",
      },
    ],
  },
  {
    id: "noah",
    name: "Noah Williams",
    handle: "@noahw",
    initials: "NW",
    avatar: "linear-gradient(135deg, #7cc1e8, #5777c9)",
    online: false,
    lastMessage: "The link is in the thread.",
    lastTime: "09:18",
    expiry: "18h 05m",
    messages: [
      {
        id: "n1",
        sender: "them",
        type: "text",
        text: "The link is in the thread.",
        time: "09:18",
      },
    ],
  },
  {
    id: "amara",
    name: "Amara Okafor",
    handle: "@amara.o",
    initials: "AO",
    avatar: "linear-gradient(135deg, #f1a773, #d96d7e)",
    online: true,
    lastMessage: "Sent a video",
    lastTime: "Yesterday",
    expiry: "04h 44m",
    messages: [
      {
        id: "a1",
        sender: "them",
        type: "video",
        time: "Yesterday",
        accent: "linear-gradient(145deg, #f0b776, #e77d91 50%, #7a7ad8)",
      },
    ],
  },
  {
    id: "leo",
    name: "Leo Martins",
    handle: "@leom",
    initials: "LM",
    avatar: "linear-gradient(135deg, #90d4bd, #6da5d9)",
    online: false,
    lastMessage: "You: See you soon.",
    lastTime: "Mon",
    expiry: "—",
    messages: [
      {
        id: "l1",
        sender: "me",
        type: "text",
        text: "See you soon.",
        time: "Mon",
        read: true,
      },
    ],
  },
];

export const statuses = [
  {
    id: "mira-status",
    name: "Mira",
    initials: "MC",
    time: "18m ago",
    avatar: "linear-gradient(135deg, #f5b7a9 5%, #ba83e8 92%)",
    accent: "linear-gradient(145deg, #ffe2c7, #c3d7ff 58%, #83b6ee)",
  },
  {
    id: "amara-status",
    name: "Amara",
    initials: "AO",
    time: "3h ago",
    avatar: "linear-gradient(135deg, #f1a773, #d96d7e)",
    accent: "linear-gradient(145deg, #f6b56b, #e67c8f 50%, #7276ce)",
  },
  {
    id: "noah-status",
    name: "Noah",
    initials: "NW",
    time: "5h ago",
    avatar: "linear-gradient(135deg, #7cc1e8, #5777c9)",
    accent: "linear-gradient(145deg, #bde9f7, #7c9fe7 55%, #445595)",
  },
];
