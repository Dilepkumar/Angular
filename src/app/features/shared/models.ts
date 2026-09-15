// ── Auth ──
export interface User {
  id: number;
  email: string;
  name?: string;
  fullName?: string;
  phone?: string;
  avatarUrl?: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  user: User;
}

// ── Groups ──
export interface Group {
  id: string;
  groupName?: string;
  inviteCode?: string;
  monthlyPoolTarget?: number;
  role?: string;
  memberCount?: number;
}

export interface GroupMember {
  id: number;
  name: string;            // templates call m.name.charAt(0) / .split(' ')
  fullName?: string;
  email?: string;
  role?: string;
  status?: string;
  userId?: number;
  isAdmin?: boolean;
}

export interface GroupMemberVm {
  id: number;
  name?: string;
  fullName?: string;
}

// ── Bills ──
export interface Bill {
  id: string;
  billName: string;
  description?: string;
  amount: number;
  paidByUserId?: number;
  paidByName?: string;
  dueDate?: string;
  splits: BillSplit[];
}

export interface BillSplit {
  id: string;
  billId?: string;
  userId: number;
  userName: string;
  shareAmount: number;
  isPaid: boolean;
}

export interface MonthlyBillsOverview {
  month?: string;
  totalDue?: number;
  totalAmount?: number;
  totalPaid?: number;
  bills: Bill[];
}

// ── Dashboard ──
export interface ActionItem {
  message: string;
  type?: string;           // 'pool_low' | 'iou_owe' | 'iou_owed' | 'bill_due' | ...
  link?: string;
  at?: string;
}

export interface ActivityItem {
  at: string;
  bucket?: string;         // 'iou' | 'bills' | 'pool'
  actor?: string;
  text?: string;
}

export interface DashCard {
  title?: string;
  primaryNumber?: number;
  status?: 'ok' | 'attention' | 'danger' | string;
}

export interface Dashboard {
  groupName?: string;
  memberCount?: number;
  monthlyPoolTarget?: number;
  poolBalance?: number;
  myTotalOwed?: number;
  myTotalDue?: number;
  upcomingBills?: Bill[];
  actionItems: ActionItem[];      // a.message, a.type, a.link
  members: GroupMember[];         // m.name, m.isAdmin
  recentActivity: ActivityItem[]; // a.bucket, a.actor, a.text, a.at
  iou?: DashCard;                 // d.iou.title / .primaryNumber / .status
  bills?: DashCard;
  pool?: DashCard;
}

// ── IOU / Balances ──
export interface DebtPair {
  fromUserId: number;
  fromUserName: string;    // template uses fromUserName (NOT fromName)
  toUserId: number;
  toUserName: string;      // non-optional → charAt(0) safe
  amount: number;
}

export interface MyBalance {
  netBalance: number;
  youAreOwed?: number;
  youOwe?: number;
  iOwe: DebtPair[];
  owedToMe: DebtPair[];
  debts?: DebtPair[];
}

// ── Pool ──
export interface Category {
  id: string;
  name: string;
  budget?: number;
  spent?: number;
}

export interface PoolMemberStatus {
  userId: number;
  userName: string;
  contributedThisMonth?: number;
  expectedThisMonth?: number;
  hasPaidTarget?: boolean;
}



export interface PoolTransaction {
  id: string; 
  type: string; 
  description: string; 
  userName: string;
  date: string; 
  amount: number;
  status: string; 
  approvedBy: string | null; 
  rejectReason: string | null;
}

export interface PoolBalance {
  currentBalance: number;    // non-optional → fixes @if comparison
  monthlyTarget: number;
  totalContributions?: number;
  totalSpent?: number;
  memberStatuses: PoolMemberStatus[];
  recentTransactions: PoolTransaction[];
  categories?: Category[];
}

// ── Notifications ──
export interface Notification {
  id: string;
  type: string;              // non-optional → icon(n.type) arg safe
  title?: string;
  body?: string;
  message?: string;
  createdAt?: string;
  isRead?: boolean;
}
export interface PendingContribution {
  id: number; 
  userId: number; 
  userName: string;
  amount: number; 
  contributedOn: string; 
  periodMonth: string; 
  transactionRef: string | null;
}

export interface MemberStatus {
  userId: number; userName: string; isAlias: boolean;
  contributedThisMonth: number; expectedThisMonth: number;
  hasPaidTarget: boolean; pendingAmount: number;
}
