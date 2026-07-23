export const currentUser = {
  id: 'user-1',
  name: 'Maya Sharma',
  initials: 'MS',
  role: 'Student',
};

export const classroom = {
  name: 'Class 10 · Section A',
  school: 'Greenwood School',
  code: 'DEMO-10A',
  members: [
    { id: 'user-1', name: 'Maya Sharma', initials: 'MS', role: 'Student', online: true },
    { id: 'user-2', name: 'Arjun Rao', initials: 'AR', role: 'Student', online: true },
    { id: 'user-3', name: 'Sara Khan', initials: 'SK', role: 'Student', online: false },
    { id: 'teacher-1', name: 'Ms. Fernandes', initials: 'MF', role: 'Moderator', online: true },
  ],
  announcements: [
    {
      id: 'announcement-1',
      title: 'Science project teams',
      body: 'Team lists are posted. Please check in with your group before Friday.',
      author: 'Ms. Fernandes',
      date: 'Today',
    },
    {
      id: 'announcement-2',
      title: 'Class picnic consent forms',
      body: 'Bring signed consent forms to class by Monday morning.',
      author: 'Ms. Fernandes',
      date: 'Yesterday',
    },
  ],
};

export const conversations = [
  {
    id: 'class-chat',
    name: 'Class chat',
    detail: '4 members',
    initials: '10A',
    unread: 3,
    kind: 'group',
  },
  {
    id: 'science-team',
    name: 'Science project',
    detail: '3 members',
    initials: 'SP',
    unread: 0,
    kind: 'group',
  },
  {
    id: 'arjun',
    name: 'Arjun Rao',
    detail: 'Online',
    initials: 'AR',
    unread: 0,
    kind: 'direct',
  },
];

export const messages = {
  'class-chat': [
    {
      id: 'message-1',
      authorId: 'teacher-1',
      author: 'Ms. Fernandes',
      initials: 'MF',
      text: 'Welcome to our private class space. Please keep conversations kind and on topic.',
      time: '9:02 AM',
      moderator: true,
    },
    {
      id: 'message-2',
      authorId: 'user-2',
      author: 'Arjun Rao',
      initials: 'AR',
      text: 'Does anyone have the science project brief?',
      time: '9:18 AM',
    },
    {
      id: 'message-3',
      authorId: 'user-1',
      author: 'Maya Sharma',
      initials: 'MS',
      text: 'I do! It is in the announcements tab.',
      time: '9:20 AM',
    },
  ],
  'science-team': [
    {
      id: 'message-4',
      authorId: 'user-3',
      author: 'Sara Khan',
      initials: 'SK',
      text: 'I can prepare the slides if someone shares the experiment notes.',
      time: 'Yesterday',
    },
  ],
  arjun: [
    {
      id: 'message-5',
      authorId: 'user-2',
      author: 'Arjun Rao',
      initials: 'AR',
      text: 'Want to compare our maths answers after school?',
      time: 'Yesterday',
    },
  ],
};
