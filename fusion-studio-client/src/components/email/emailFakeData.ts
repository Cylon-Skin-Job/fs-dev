/**
 * @module emailFakeData
 * @role Stub message data for the email mockup surface. Replaced by the
 *       SQLite mail schema in Phase 2 (Email_Workspace_SPEC).
 */

export interface FakeEmailMessage {
  id: string;
  from: string;
  fromAddress: string;
  subject: string;
  snippet: string;
  body: string[];
  time: string;
  labels: string[];
  folder?: string;
  unread?: boolean;
  starred?: boolean;
}

export interface FakeEmailAccount {
  id: string;
  name: string;
  address: string;
  provider: string;
  initials: string;
  color: string;
  unread: number;
}

export const EMAIL_FAKE_ACCOUNTS: FakeEmailAccount[] = [
  {
    id: 'acct-primary',
    name: 'Ronald Curtright Jr.',
    address: 'ronald@curtrightservices.com',
    provider: 'iCloud',
    initials: 'RC',
    color: '#496f9e',
    unread: 8,
  },
  {
    id: 'acct-gmail',
    name: 'Ronald Gmail',
    address: 'rcurtrightjr@gmail.com',
    provider: 'Gmail',
    initials: 'RG',
    color: '#7a6a3f',
    unread: 3,
  },
  {
    id: 'acct-outlook',
    name: 'Service Desk',
    address: 'dispatch@curtrightservices.com',
    provider: 'Outlook',
    initials: 'SD',
    color: '#5f7d5c',
    unread: 1,
  },
];

export const EMAIL_FAKE_MESSAGES: FakeEmailMessage[] = [
  {
    id: 'msg-001',
    from: 'Dollar Shave Club',
    fromAddress: 'members@dollarshaveclub.com',
    subject: 'Last hours: the shave kit for $2.50',
    snippet: 'Handle, blades, shave butter. Free shipping.',
    body: [
      '250 years ago, we revolted against overpriced BS. Today, a $2.50 No Frills Starter Set that ships free — but not for long.',
      'Feel our Best Razor Ever before the deal, and the $2.50, are gone.',
    ],
    time: '3:31 PM',
    labels: ['inbox'],
    unread: true,
  },
  {
    id: 'msg-002',
    from: 'Mammoth Hospital',
    fromAddress: 'facilities@mammothhospital.com',
    subject: 'Hood cleaning schedule — site access instructions',
    snippet: 'Loading dock code changed. Night crew access is now through the east entrance.',
    body: [
      'Hi Ronald,',
      'Ahead of next week’s scheduled hood cleaning: the loading dock code changed on the 1st. Night crew access is now through the east entrance — badge in at the security desk and they’ll walk you to the kitchen.',
      'Please confirm your crew size so we can have vests ready.',
    ],
    time: 'Jul 3',
    labels: ['inbox'],
    folder: 'Client Email',
    starred: true,
    unread: true,
  },
  {
    id: 'msg-003',
    from: 'Wells Fargo',
    fromAddress: 'alerts@notify.wellsfargo.com',
    subject: "We've got your mobile deposit",
    snippet: 'Your mobile deposit was received and is being processed.',
    body: [
      'Your mobile deposit of $1,250.00 was received on July 5 and is being processed.',
      'Funds are typically available the next business day.',
    ],
    time: '5:22 AM',
    labels: ['inbox'],
    folder: 'Banking',
  },
  {
    id: 'msg-004',
    from: 'Apple Card Support',
    fromAddress: 'no_reply@apple.com',
    subject: 'Important Account Notification',
    snippet: 'Apple Card Customer: Ronald Curtright Jr. Your July statement is ready.',
    body: [
      'Your July statement is ready to view in Wallet.',
      'Statement balance: $482.19. Payment due July 31.',
    ],
    time: '12:01 PM',
    labels: ['inbox'],
    folder: 'Banking',
  },
  {
    id: 'msg-005',
    from: 'MasterClass',
    fromAddress: 'hello@mail.masterclass.com',
    subject: 'Is aging something you’re prepared for?',
    snippet: 'Your brain, skin, and retirement plan all need attention.',
    body: [
      'Your brain, skin, and retirement plan all need attention — and the world’s best instructors have thoughts on all three.',
    ],
    time: '7:28 AM',
    labels: ['inbox'],
  },
  {
    id: 'msg-006',
    from: 'Netflix',
    fromAddress: 'info@account.netflix.com',
    subject: 'Time is running out to update payment',
    snippet: 'Your shows and movies miss you.',
    body: [
      'We couldn’t process your last payment. Update your payment method to keep watching.',
    ],
    time: '1:27 AM',
    labels: ['inbox'],
    unread: true,
  },
  {
    id: 'msg-007',
    from: 'PDF Books by Bruce',
    fromAddress: 'digest@academia.edu',
    subject: 'Bulk Download 37 books in "Philosophy"',
    snippet: 'You downloaded a paper related to your reading list.',
    body: [
      'Based on your recent downloads, 37 books in Philosophy are available as a bulk download this week.',
    ],
    time: 'Jul 2',
    labels: ['snoozed'],
  },
  {
    id: 'msg-008',
    from: 'To: Mammoth Hospital',
    fromAddress: 'facilities@mammothhospital.com',
    subject: 'Re: Quote for hood cleaning — June service',
    snippet: 'Quote attached. Crew of three, night window, done before the 6 AM prep shift.',
    body: [
      'Hi team,',
      'Quote attached for the June service. Crew of three, night window, done before the 6 AM prep shift as usual.',
      'Let me know if the access changes and I’ll update the work order.',
    ],
    time: 'Jul 1',
    labels: ['sent'],
    folder: 'Client Email',
  },
  {
    id: 'msg-009',
    from: 'To: Karen Curtright',
    fromAddress: 'karen@example.com',
    subject: 'Invoice for June services',
    snippet: 'Scheduled to send Monday 9:00 AM.',
    body: [
      'June invoice attached. Net 15 as agreed.',
    ],
    time: 'Jul 7, 9:00 AM',
    labels: ['scheduled'],
  },
  {
    id: 'msg-010',
    from: 'Draft',
    fromAddress: '',
    subject: 'Follow-up: east entrance access for night crew',
    snippet: 'Confirming crew size and badge pickup before next week’s…',
    body: [
      'Confirming crew size and badge pickup before next week’s service —',
    ],
    time: 'Jul 4',
    labels: ['drafts'],
    folder: 'Client Email',
  },
  {
    id: 'msg-011',
    from: 'Candy AI',
    fromAddress: 'promo@candy-ai-mailer.net',
    subject: 'The fireworks are going off. The night is almost over.',
    snippet: 'Last night of the celebration. Do not miss it.',
    body: [
      'Last night of the celebration. Do not miss it.',
    ],
    time: '4:48 AM',
    labels: ['spam'],
  },
  {
    id: 'msg-012',
    from: 'Pendulum',
    fromAddress: 'team@pendulumlife.com',
    subject: 'Built on innovation. Designed to do what others can’t.',
    snippet: 'Meet the PhDs who turned microbiome science into daily habits.',
    body: [
      'Meet the PhDs who turned microbiome science into daily habits.',
    ],
    time: 'Jul 3',
    labels: ['trash'],
  },
];
