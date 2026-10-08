// ── Auth ──
export interface User {
  id: number;
  email: string;
  name?: string;
  fullName?: string;
  phone?: string;
  avatarUrl?: string;
  upiId?: string;
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
  paidFromPool?: boolean;
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
  upiId?: string | null;
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
  isAdmin?: boolean;
  role?: string;
  isAlias?: boolean;
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
  isLowBalance?: boolean;
  lowThreshold?: number;
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
  pendingApprovalAmount?: number;
  hasPendingApproval?: boolean;
  isAdmin?: boolean;
  role?: string;
}

// ── Electricity Bill Monitoring ──
export interface ElectricityBiller {
  id: string;
  name: string;
  category: string;
  state?: string;
  coverage?: string;
  isActive: boolean;
}

export interface ElectricityCustomerParam {
  paramId: string;
  paramName: string;
  dataType: string;
  isOptional: boolean;
  minLength?: number;
  maxLength?: number;
  regex?: string;
  hint?: string;
}

export interface ElectricityBillerDetail {
  billerId: string;
  billerName: string;
  category: string;
  state?: string;
  customerParams: ElectricityCustomerParam[];
}

export interface ElectricityBill {
  id: number;
  electricityBillId: number;
  electricityAccountId: number;
  groupId: number;
  billerId: string;
  billerName: string;
  consumerNumber: string;
  customerName?: string;
  billNumber?: string;
  billDate?: string;
  billPeriod?: string;
  dueDate?: string;
  billAmount: number;
  acdAmount?: number;
  arrears: number;
  lateFee: number;
  totalAmount: number;
  providerReference?: string;
  fetchSource: string;
  isSplitCreated: boolean;
  isPaidAtProvider?: boolean;
  paidAtProviderDate?: string;
  createdAt: string;
}

export interface ElectricityAccount {
  id: number;
  electricityAccountId: number;
  groupId: number;
  billerId: string;
  billerName: string;
  consumerNumber: string;
  customerParameters: Record<string, string>;
  customerName?: string;
  createdByUserId: number;
  isActive: boolean;
  expectedBillDayOfMonth?: number;
  estimatedNextBillDate?: string;
  monitoringStatus: 'MONITORING' | 'BILL_GENERATED' | 'NO_BILL' | 'INVALID_CONSUMER' | 'PROVIDER_ERROR' | string;
  lastCheckedAt?: string;
  nextCheckAt?: string;
  lastCheckStatus?: string;
  lastCheckMessage?: string;
  manualChecksTodayCount: number;
  remainingManualChecksToday: number;
  createdAt: string;
  latestBill?: ElectricityBill;
}

export interface ElectricityCheckLog {
  id: number;
  electricityCheckLogId: number;
  checkType: string;
  status: string;
  message?: string;
  checkedAt: string;
}

export interface ElectricityMonitoringStatus {
  accountId: number;
  electricityAccountId: number;
  billerName: string;
  consumerNumber: string;
  monitoringStatus: string;
  lastCheckedAt?: string;
  nextCheckAt?: string;
  lastCheckStatus?: string;
  lastCheckMessage?: string;
  manualChecksTodayCount: number;
  remainingManualChecksToday: number;
  canManualCheck: boolean;
  recentLogs: ElectricityCheckLog[];
}

export interface ElectricitySplitItem {
  userId: number;
  userName: string;
  shareAmount: number;
  isPaid: boolean;
  paidAt?: string;
}

export interface ElectricityBillSplits {
  billId: number;
  billNumber?: string;
  billPeriod?: string;
  totalAmount: number;
  dueDate?: string;
  splits: ElectricitySplitItem[];
}

