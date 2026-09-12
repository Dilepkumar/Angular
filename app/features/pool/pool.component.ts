import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { PendingContribution, MemberStatus } from '../shared/models';
import { environment } from '../../../environments/environment';

export interface PoolTransactionItem {
  id?: number;
  itemName: string;
  amount: number;
  expenseCategoryId?: number | null;
}

export interface PoolTransaction {
  id: string;
  type: 'Contribution' | 'Expense' | string;
  description: string;
  userName: string;
  date: string;
  amount: number;
  status: string;
  approvedBy?: string | null;
  rejectReason?: string | null;
  payerType?: string | null;
  payerName?: string | null;
  recorderName?: string | null;
  receiptUrl?: string | null;
  category?: string | null;
  isReimbursed?: boolean;
  items?: PoolTransactionItem[];
}

export interface CategoryItemDetail {
  itemName: string;
  total: number;
  count: number;
}

export interface CategoryBreakdownItem {
  category: string;
  total: number;
  percentage: number;
  itemCount?: number;
  items?: CategoryItemDetail[];
}

export interface OverallItemBreakdown {
  itemName: string;
  category: string;
  total: number;
  count: number;
}

export interface OutOfPocketItem {
  userId: number;
  userName: string;
  totalPaid: number;
  expenseCount: number;
  status: string;
}

export interface PoolBalance {
  isAdmin: boolean;
  pendingItems: PendingContribution[] | null;
  currentBalance: number;
  monthlyTarget: number;
  totalContributions: number;
  totalSpent: number;
  memberStatuses: MemberStatus[];
  categoryBreakdown?: CategoryBreakdownItem[];
  itemBreakdown?: OverallItemBreakdown[];
  outOfPocketSummary?: OutOfPocketItem[];
  recentTransactions: PoolTransaction[];
}

interface ReceiptRow {
  id: number;
  name: string;
  price: number | null;
}

@Component({
  selector: 'app-pool',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pool.component.html',
  styleUrls: ['./pool.component.scss']
})
export class PoolComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  groupId!: string;
  groupName = signal('Apartment 402');
  groupAddress = signal('HSR Layout, Sector 2');

  // ── Main Pool Data ──
  balance = signal<PoolBalance | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  toastMessage = signal<string | null>(null);

  // ── Admin: Pending Approvals ──
  isAdmin = signal(false);
  pending = signal<PendingContribution[]>([]);
  showPending = false;
  showRejectFor: PendingContribution | null = null;
  rejectReason = '';

  // ── Transaction Filter Tabs & Pagination ──
  filters = ['all', 'Contribution', 'Expense'] as const;
  filter = signal<'all' | 'Contribution' | 'Expense'>('all');
  expandedReceipts = signal<Set<string>>(new Set<string>());
  displayLimit = signal<number>(5);

  // ── Target Explanation Info Toggle ──
  showTargetInfo = signal<boolean>(false);

  // ── Category vs Item-wise Tracking View ──
  breakdownView = signal<'category' | 'items'>('category');
  expandedCategories = signal<Set<string>>(new Set<string>());

  // ── Ledger History Modal ──
  showHistory = signal<boolean>(false);
  historyPeriod = signal<'daily' | 'weekly' | 'monthly' | 'custom'>('monthly');
  historyFromDate = '';
  historyToDate = '';
  historyLoading = signal<boolean>(false);
  historyData = signal<{
    period: string;
    fromDate?: string;
    toDate?: string;
    totalIn: number;
    totalOut: number;
    netChange: number;
    totalCount: number;
    transactions: PoolTransaction[];
  } | null>(null);

  // ── Embedded "Log New Expense" State ──
  showExpenseForm = signal(true);
  expensePayer = signal<'pool' | 'me'>('pool');
  paidByMemberId = signal<number | null>(null);

  expenseName = '';
  expenseDate = new Date().toISOString().slice(0, 10);
  expenseCategory = '🥕 Groceries';
  customCategory = '';
  categories = [
    '🥕 Groceries',
    '🥛 Dairy & Essentials',
    '⚡ Utilities & Bills',
    '🧴 Cleaning & Household',
    '🍕 Food & Snacks',
    '🔧 Maintenance & Repairs',
    '🚕 Travel & Transport',
    '📦 Other'
  ];

  expenseTotal: number | null = null;
  expenseRows: ReceiptRow[] = [];
  rowCounter = 0;
  savingExpense = false;

  // Receipt image attachment
  receiptPreview = signal<string | null>(null);
  receiptUrl: string | null = null;
  uploadingReceipt = signal(false);
  selectedReceiptImage = signal<string | null>(null);

  // Dynamic flat members for "SHARED AMONG FLAT"
  splitWith = signal<{ id: string; name: string; initials: string; selected: boolean }[]>([]);

  // ── Quick Contribute Modal ──
  showContribute = false;
  contributeMode = signal<'per_person' | 'total_split'>('per_person');
  contributeAmount: number | null = 500;
  contributeMessage = '';
  contributing = false;
  contributeMembers = signal<{ userId: number; name: string; initials: string; selected: boolean }[]>([]);

  // ── Admin: Shares & Target ──
  showShares = false;
  realMembers: { userId: number; name: string; monthlyShare: number }[] = [];
  aliasMembers: { aliasName: string; monthlyShare: number }[] = [];

  showTarget = false;
  targetInput: number | null = null;
  savingTarget = false;

  ngOnInit(): void {
    this.groupId = this.route.snapshot.paramMap.get('groupId') || localStorage.getItem('rl_group_id') || '1';
    this.initExpenseForm();

    // Check if query params specified an action
    const action = this.route.snapshot.queryParamMap.get('action');
    if (action === 'expense') {
      this.showExpenseForm.set(true);
      setTimeout(() => {
        document.getElementById('log-expense-card')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    } else if (action === 'contribute') {
      this.openContribute();
    }

    this.load();
    this.loadGroupInfo();
  }

  initExpenseForm(): void {
    if (this.expenseRows.length === 0) {
      this.rowCounter = 1;
      this.expenseRows = [{ id: 1, name: '', price: null }];
    }
  }

  get me() {
    return this.auth.user();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<PoolBalance>(`groups/${this.groupId}/pool/balance`).subscribe({
      next: (b) => {
        this.balance.set(b);
        this.isAdmin.set(b.isAdmin);
        this.pending.set(b.pendingItems ?? []);

        // Dynamically populate room members in "SHARED AMONG FLAT" and "Add Money"
        if (b.memberStatuses && b.memberStatuses.length > 0) {
          const currentSelected = new Set(this.splitWith().filter(s => s.selected).map(s => s.id));
          const hasExisting = this.splitWith().length > 0;
          this.splitWith.set(b.memberStatuses.map(m => ({
            id: String(m.userId),
            name: m.userName,
            initials: this.getInitials(m.userName),
            selected: hasExisting ? currentSelected.has(String(m.userId)) : true
          })));

          // Populate contributing members
          this.contributeMembers.set(b.memberStatuses.map(m => ({
            userId: m.userId,
            name: m.userName,
            initials: this.getInitials(m.userName),
            selected: true
          })));

          // Default paidByMemberId to current user if available
          if (!this.paidByMemberId() && this.me?.id) {
            this.paidByMemberId.set(this.me.id);
          }
        }

        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(e.error?.message ?? 'Failed to load pool data');
        this.loading.set(false);
      }
    });
  }

  loadGroupInfo(): void {
    this.api.get<any>(`groups/${this.groupId}`).subscribe({
      next: (g) => {
        if (g?.groupName) this.groupName.set(g.groupName);
      },
      error: () => {}
    });
  }

  getInitials(name: string): string {
    if (!name?.trim()) return 'DK';
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  toggleExpenseForm(): void {
    this.showExpenseForm.set(!this.showExpenseForm());
  }

  // ═══════════════════════════════════════════
  // RECEIPT & ATTACHMENT METHODS
  // ═══════════════════════════════════════════
  onReceiptPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      this.showToast('⚠️ Image must be under 5 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.receiptPreview.set(reader.result as string);
    };
    reader.readAsDataURL(file);

    const fd = new FormData();
    fd.append('file', file);
    this.uploadingReceipt.set(true);

    this.api.postForm<{ receiptUrl: string }>(`groups/${this.groupId}/pool/receipt`, fd).subscribe({
      next: (res) => {
        this.receiptUrl = res.receiptUrl;
        this.uploadingReceipt.set(false);
        this.showToast('📸 Bill receipt attached!');
      },
      error: (err: any) => {
        this.uploadingReceipt.set(false);
        this.showToast(err.error?.message ?? '⚠️ Receipt upload failed');
      }
    });
  }

  removeReceipt(): void {
    this.receiptPreview.set(null);
    this.receiptUrl = null;
  }

  viewReceipt(url?: string | null): void {
    if (!url) return;
    this.selectedReceiptImage.set(this.getFullUrl(url));
  }

  closeReceiptModal(): void {
    this.selectedReceiptImage.set(null);
  }

  getFullUrl(path?: string | null): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  // ═══════════════════════════════════════════
  // ITEMIZED EXPENSE METHODS
  // ═══════════════════════════════════════════
  addRow(): void {
    this.rowCounter++;
    this.expenseRows.push({ id: this.rowCounter, name: '', price: null });
  }

  removeRow(id: number): void {
    this.expenseRows = this.expenseRows.filter(r => r.id !== id);
    if (this.expenseRows.length > 0) {
      this.expenseTotal = this.itemsSum;
    }
  }

  onRowPriceChange(): void {
    if (this.expenseRows.length > 0) {
      this.expenseTotal = this.itemsSum;
    }
  }

  get itemsSum(): number {
    return this.expenseRows.reduce((acc, r) => acc + (r.price || 0), 0);
  }

  get isReceiptBalanced(): boolean {
    if (this.expenseRows.length === 0) return true;
    if (this.expenseTotal === null) return false;
    return Math.abs(this.expenseTotal - this.itemsSum) < 0.01;
  }

  get receiptMismatchDiff(): number {
    if (this.expenseTotal === null) return 0;
    return Math.abs(this.expenseTotal - this.itemsSum);
  }

  toggleSplitParticipant(id: string): void {
    this.splitWith.update(list =>
      list.map(p => p.id === id ? { ...p, selected: !p.selected } : p)
    );
  }

  selectAllSplit(select: boolean): void {
    this.splitWith.update(list => list.map(p => ({ ...p, selected: select })));
  }

  getMemberBgColor(id: string | number): string {
    const colors = [
      'linear-gradient(135deg, #00b074, #059669)',
      'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      'linear-gradient(135deg, #f59e0b, #d97706)',
      'linear-gradient(135deg, #ec4899, #be185d)',
      'linear-gradient(135deg, #8b5cf6, #6d28d9)',
      'linear-gradient(135deg, #14b8a6, #0f766e)'
    ];
    const num = typeof id === 'number' ? id : (parseInt(id, 10) || (id ? id.charCodeAt(0) : 0));
    return colors[Math.abs(num) % colors.length];
  }

  getPayerDisplayName(): string {
    if (this.expensePayer() === 'pool') {
      return 'Central Room Pool';
    }
    const memberId = this.paidByMemberId();
    if (!memberId || memberId === this.me?.id) {
      return this.me?.fullName || 'You';
    }
    const member = this.balance()?.memberStatuses.find(m => m.userId === memberId);
    return member?.userName || 'Roommate';
  }

  getCleanCategoryName(cat: string): string {
    if (!cat) return 'Groceries';
    const cleaned = cat.replace(/^[\p{Emoji}\p{Extended_Pictographic}\s]+/u, '').trim();
    return cleaned || cat.trim();
  }

  submitExpense(): void {
    const desc = this.expenseName.trim();
    if (!desc) {
      this.showToast('⚠️ Please enter an expense name');
      return;
    }

    if (!this.expenseTotal || this.expenseTotal <= 0) {
      this.showToast('⚠️ Total spend must be greater than zero');
      return;
    }

    if (this.expenseRows.length === 0) {
      this.showToast('⚠️ Please add at least one itemized receipt item');
      return;
    }

    const validItems = this.expenseRows
      .filter(r => r.name.trim() && r.price !== null && r.price > 0);

    if (validItems.length === 0) {
      this.showToast('⚠️ Please enter item name and price for receipt items');
      return;
    }

    if (!this.isReceiptBalanced) {
      this.showToast('⚠️ Please balance receipt items with total spend first');
      return;
    }

    const items = validItems.map(r => ({
      itemName: r.name.trim(),
      amount: r.price!,
      categoryId: null
    }));

    const payerType = this.expensePayer();
    const paidByUserId = payerType === 'me' ? (this.paidByMemberId() || this.me?.id || null) : null;
    const selectedMemberIds = this.splitWith().filter(m => m.selected).map(m => m.id);

    const selectedCat = this.expenseCategory === '📦 Other' && this.customCategory.trim()
      ? this.customCategory.trim()
      : this.expenseCategory;
    const finalCategory = this.getCleanCategoryName(selectedCat);

    const payload = {
      description: desc,
      expenseDate: this.expenseDate,
      category: finalCategory,
      receiptUrl: this.receiptUrl,
      payerType: payerType,
      paidByUserId: paidByUserId,
      sharedMemberIds: selectedMemberIds,
      items: items
    };

    this.savingExpense = true;
    this.api.post<{ message: string }>(`groups/${this.groupId}/pool/expenses`, payload).subscribe({
      next: (res) => {
        this.savingExpense = false;
        this.showToast(`✅ ${res.message || 'Expense logged to Daily Pool!'}`);
        this.load();
        
        // Reset expense form completely
        this.expenseName = '';
        this.expenseTotal = null;
        this.expenseDate = new Date().toISOString().slice(0, 10);
        this.expenseCategory = '🥕 Groceries';
        this.customCategory = '';
        this.expensePayer.set('pool');
        if (this.me?.id) this.paidByMemberId.set(this.me.id);
        this.receiptUrl = null;
        this.receiptPreview.set(null);
        this.rowCounter = 1;
        this.expenseRows = [{ id: 1, name: '', price: null }];
        this.splitWith.update(list => list.map(m => ({ ...m, selected: true })));
        
        // Automatically hide the form after expense added
        this.showExpenseForm.set(false);
      },
      error: (e) => {
        this.savingExpense = false;
        this.showToast(`❌ ${e.error?.message || 'Failed to log expense'}`);
      }
    });
  }

  // ═══════════════════════════════════════════
  // QUICK CONTRIBUTE METHODS
  // ═══════════════════════════════════════════
  openContribute(): void {
    this.showContribute = true;
    this.contributeAmount = 500;
    this.contributeMessage = '';
    this.contributeMode.set('per_person');
    if (this.balance()?.memberStatuses) {
      this.contributeMembers.set(this.balance()!.memberStatuses.map(m => ({
        userId: m.userId,
        name: m.userName,
        initials: this.getInitials(m.userName),
        selected: true
      })));
    }
  }

  closeContribute(): void {
    this.showContribute = false;
  }

  setContributeMode(mode: 'per_person' | 'total_split'): void {
    this.contributeMode.set(mode);
    if (mode === 'per_person' && (!this.contributeAmount || this.contributeAmount > 5000)) {
      this.contributeAmount = 500;
    } else if (mode === 'total_split' && (!this.contributeAmount || this.contributeAmount < 1000)) {
      this.contributeAmount = 5000;
    }
  }

  setPresetAmount(amt: number): void {
    this.contributeAmount = amt;
  }

  toggleContributeMember(userId: number): void {
    this.contributeMembers.update(list =>
      list.map(m => m.userId === userId ? { ...m, selected: !m.selected } : m)
    );
  }

  selectAllContributeMembers(select: boolean): void {
    this.contributeMembers.update(list => list.map(m => ({ ...m, selected: select })));
  }

  get selectedContributeCount(): number {
    return this.contributeMembers().filter(m => m.selected).length;
  }

  get calculatedTotalContribute(): number {
    const amt = this.contributeAmount || 0;
    if (this.contributeMode() === 'per_person') {
      return amt * this.selectedContributeCount;
    }
    return amt;
  }

  get calculatedPerMemberShare(): number {
    const amt = this.contributeAmount || 0;
    const count = this.selectedContributeCount;
    if (this.contributeMode() === 'total_split') {
      return count > 0 ? Math.round(amt / count) : 0;
    }
    return amt;
  }

  submitContribution(): void {
    const amt = this.contributeAmount;
    if (!amt || amt <= 0) {
      this.showToast('⚠️ Please enter a valid contribution amount');
      return;
    }

    const selectedMembers = this.contributeMembers().filter(m => m.selected);
    if (selectedMembers.length === 0) {
      this.showToast('⚠️ Please select at least one contributing roommate');
      return;
    }

    this.contributing = true;
    const payload = {
      amount: amt,
      message: this.contributeMessage.trim() || null,
      transactionRef: this.contributeMessage.trim() || null,
      memberUserIds: selectedMembers.map(m => m.userId),
      mode: this.contributeMode()
    };

    this.api.post<{ message: string }>(`groups/${this.groupId}/pool/contribute`, payload).subscribe({
      next: (res) => {
        this.contributing = false;
        this.showContribute = false;
        this.showToast(`🎉 ${res.message || 'Contribution added to pool balance!'}`);
        this.load();
      },
      error: (e) => {
        this.contributing = false;
        this.showToast(`❌ ${e.error?.message || 'Contribution failed'}`);
      }
    });
  }

  // ═══════════════════════════════════════════
  // RECEIPT ACCORDIONS & FILTERING
  // ═══════════════════════════════════════════
  toggleReceipt(id: string): void {
    const set = new Set(this.expandedReceipts());
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    this.expandedReceipts.set(set);
  }

  isReceiptExpanded(id: string): boolean {
    return this.expandedReceipts().has(id);
  }

  setFilter(f: 'all' | 'Contribution' | 'Expense'): void {
    this.filter.set(f);
    this.displayLimit.set(5);
  }

  filteredTransactions(): PoolTransaction[] {
    const list = this.balance()?.recentTransactions ?? [];
    const f = this.filter();
    return f === 'all' ? list : list.filter(t => t.type === f);
  }

  displayedTransactions(): PoolTransaction[] {
    return this.filteredTransactions().slice(0, this.displayLimit());
  }

  hasMoreTransactions(): boolean {
    return this.filteredTransactions().length > this.displayLimit();
  }

  loadMoreTransactions(): void {
    this.displayLimit.update(n => n + 5);
  }

  toggleTargetInfo(): void {
    this.showTargetInfo.update(v => !v);
  }

  toggleCategory(catName: string): void {
    const set = new Set(this.expandedCategories());
    if (set.has(catName)) {
      set.delete(catName);
    } else {
      set.add(catName);
    }
    this.expandedCategories.set(set);
  }

  isCategoryExpanded(catName: string): boolean {
    return this.expandedCategories().has(catName);
  }

  setBreakdownView(view: 'category' | 'items'): void {
    this.breakdownView.set(view);
  }

  // ── Category Icon & Color Helpers ──
  getCategoryIcon(category: string): string {
    const cat = (category || '').toLowerCase();
    if (cat.includes('grocer')) return '🥕';
    if (cat.includes('dairy') || cat.includes('milk')) return '🥛';
    if (cat.includes('utilit') || cat.includes('bill') || cat.includes('power')) return '⚡';
    if (cat.includes('clean') || cat.includes('house')) return '🧴';
    if (cat.includes('food') || cat.includes('snack')) return '🍕';
    if (cat.includes('maint') || cat.includes('repair')) return '🔧';
    if (cat.includes('travel') || cat.includes('cab')) return '🚕';
    return '📦';
  }

  getCategoryColor(category: string): string {
    const cat = (category || '').toLowerCase();
    if (cat.includes('grocer')) return '#10b981';
    if (cat.includes('dairy') || cat.includes('milk')) return '#06b6d4';
    if (cat.includes('utilit') || cat.includes('bill')) return '#f59e0b';
    if (cat.includes('clean') || cat.includes('house')) return '#8b5cf6';
    if (cat.includes('food') || cat.includes('snack')) return '#f97316';
    if (cat.includes('maint') || cat.includes('repair')) return '#ec4899';
    if (cat.includes('travel') || cat.includes('cab')) return '#3b82f6';
    return '#64748b';
  }

  // ── Ledger History Methods ──
  openHistory(): void {
    this.showHistory.set(true);
    this.loadHistory();
  }

  closeHistory(): void {
    this.showHistory.set(false);
  }

  setHistoryPeriod(period: 'daily' | 'weekly' | 'monthly' | 'custom'): void {
    this.historyPeriod.set(period);
    if (period !== 'custom') {
      this.loadHistory();
    }
  }

  loadHistory(): void {
    this.historyLoading.set(true);
    let params = `period=${this.historyPeriod()}`;
    if (this.historyPeriod() === 'custom') {
      if (this.historyFromDate) params += `&fromDate=${this.historyFromDate}`;
      if (this.historyToDate) params += `&toDate=${this.historyToDate}`;
    }
    this.api.get<any>(`groups/${this.groupId}/pool/history?${params}`).subscribe({
      next: (data) => {
        this.historyData.set(data);
        this.historyLoading.set(false);
      },
      error: (e) => {
        this.showToast(`❌ ${e.error?.message || 'Failed to load history'}`);
        this.historyLoading.set(false);
      }
    });
  }

  // ═══════════════════════════════════════════
  // ADMIN APPROVAL & REJECTION
  // ═══════════════════════════════════════════
  approve(c: PendingContribution): void {
    this.api.post(`groups/${this.groupId}/pool/contributions/${c.id}/approve`, {})
      .subscribe({
        next: () => {
          this.showToast(`✅ Contribution of ₹${c.amount} approved!`);
          this.load();
        },
        error: (e) => this.showToast(`❌ ${e.error?.message || 'Failed to approve'}`)
      });
  }

  openReject(c: PendingContribution): void {
    this.showRejectFor = c;
    this.rejectReason = '';
  }

  confirmReject(): void {
    if (!this.showRejectFor) return;
    const c = this.showRejectFor;
    this.api.post(`groups/${this.groupId}/pool/contributions/${c.id}/reject`, { reason: this.rejectReason })
      .subscribe({
        next: () => {
          this.showToast(`❌ Contribution of ₹${c.amount} rejected.`);
          this.showRejectFor = null;
          this.load();
        },
        error: (e) => this.showToast(`❌ ${e.error?.message || 'Failed to reject'}`)
      });
  }

  // ═══════════════════════════════════════════
  // ADMIN SHARES & TARGET MODALS
  // ═══════════════════════════════════════════
  openShares(): void {
    const ms = this.balance()?.memberStatuses ?? [];
    this.realMembers = ms.filter(m => !m.isAlias).map(m => ({
      userId: m.userId,
      name: m.userName,
      monthlyShare: m.expectedThisMonth
    }));
    this.aliasMembers = ms.filter(m => m.isAlias).map(m => ({
      aliasName: m.userName,
      monthlyShare: m.expectedThisMonth
    }));
    this.aliasMembers.push({ aliasName: '', monthlyShare: 0 });
    this.showShares = true;
  }

  get shareTotal(): number {
    const real = this.realMembers.reduce((s, m) => s + (+m.monthlyShare || 0), 0);
    const alias = this.aliasMembers.reduce((s, m) => s + (+m.monthlyShare || 0), 0);
    return real + alias;
  }

  addAliasRow(): void {
    this.aliasMembers.push({ aliasName: '', monthlyShare: 0 });
  }

  saveShares(): void {
    const shares = [
      ...this.realMembers
        .filter(m => m.monthlyShare > 0)
        .map(m => ({ userId: m.userId, aliasName: null, monthlyShare: +m.monthlyShare })),
      ...this.aliasMembers
        .filter(m => m.aliasName.trim() && m.monthlyShare > 0)
        .map(m => ({ userId: null, aliasName: m.aliasName.trim(), monthlyShare: +m.monthlyShare }))
    ];
    this.api.post<{ message: string }>(`groups/${this.groupId}/pool/shares`, { shares })
      .subscribe({
        next: () => {
          this.showShares = false;
          this.showToast('✅ Monthly shares updated!');
          this.load();
        },
        error: (e) => this.showToast(`❌ ${e.error?.message || 'Failed to update shares'}`)
      });
  }

  openTarget(): void {
    this.showTarget = true;
    this.targetInput = this.balance()?.monthlyTarget ?? 5000;
  }

  setTargetPreset(amt: number): void {
    this.targetInput = amt;
  }

  get targetPerMember(): number {
    const target = this.targetInput || 0;
    const count = this.activeMembersCount || 1;
    return Math.round(target / count);
  }

  get activeMembersCount(): number {
    return this.balance()?.memberStatuses?.length || 0;
  }

  saveTarget(): void {
    if (this.targetInput === null || this.targetInput < 0) return;
    this.savingTarget = true;
    this.api.put<{ message: string }>(`groups/${this.groupId}/pool/target`, {
      monthlyPoolTarget: this.targetInput
    }).subscribe({
      next: () => {
        this.showTarget = false;
        this.savingTarget = false;
        this.showToast('✅ Monthly target updated!');
        this.load();
      },
      error: (e) => {
        this.savingTarget = false;
        this.showToast(`❌ ${e.error?.message || 'Failed to set target'}`);
      }
    });
  }

  get remainingPercent(): number {
    const target = this.balance()?.monthlyTarget || 1;
    const balance = this.balance()?.currentBalance || 0;
    return Math.max(0, Math.min(100, Math.round((balance / target) * 100)));
  }

  showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(null), 3200);
  }

  goToDashboard(): void {
    this.router.navigate(['/g', this.groupId, 'dashboard']);
  }
}
