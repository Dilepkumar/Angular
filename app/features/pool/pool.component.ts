import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { PendingContribution, MemberStatus, PoolTransaction } from '../shared/models';

@Component({
  selector: 'app-pool',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './pool.component.html'
})
export class PoolComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  groupId!: string;

  // ── main data ──
  balance = signal<PoolBalance | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  // ── admin: pending approvals ──
  isAdmin = signal(false);
  pending = signal<PendingContribution[]>([]);
  showPending = false;
  showRejectFor: PendingContribution | null = null;
  rejectReason = '';

  // ── transaction filter tabs ──
  filters = ['all', 'Contribution', 'Expense'] as const;
  filter = signal<'all' | 'Contribution' | 'Expense'>('all');

  // ── contribute form ──
  showContribute = false;
  amount: number | null = null;
  transactionRef = '';
  contributing = false;

  // ── expense form (items-based, matches PoolExpenseDto) ──
  showExpense = false;
  expenseDescription = '';
  expenseDate = new Date().toISOString().slice(0, 10);
  expenseItems: { name: string; amount: number | null; categoryId: number | null }[] = [];
  categories: { id: number; name: string }[] = [];
  savingExpense = false;

  // ── shares (real members + aliases) ──
  showShares = false;
  realMembers: { userId: number; name: string; monthlyShare: number }[] = [];
  aliasMembers: { aliasName: string; monthlyShare: number }[] = [];

  // ── monthly target ──
  showTarget = false;
  targetInput: number | null = null;
  savingTarget = false;

  ngOnInit() {
    this.groupId = this.route.snapshot.paramMap.get('groupId')!;
    this.load();
  }

  get me() { return this.auth.user(); }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<PoolBalance>(`groups/${this.groupId}/pool/balance`).subscribe({
      next: b => {
        this.balance.set(b);
        this.isAdmin.set(b.isAdmin);
        this.pending.set(b.pendingItems ?? []);
        this.loading.set(false);
      },
      error: e => {
        this.error.set(e.error?.message ?? 'Failed to load pool');
        this.loading.set(false);
      }
    });
  }

  // ══════════ CONTRIBUTE ══════════
  openContribute() {
    this.showContribute = true;
    this.amount = null;
    this.transactionRef = '';
  }

  submitContribution() {
    if (!this.amount || this.amount <= 0) return;
    this.contributing = true;
    this.api.post<{ message: string }>(`groups/${this.groupId}/pool/contribute`, {
      amount: this.amount,
      transactionRef: this.transactionRef.trim() || null
    }).subscribe({
      next: r => {
        this.showContribute = false;
        this.contributing = false;
        alert(r.message);
        this.load();
      },
      error: e => {
        this.contributing = false;
        alert(e.error?.message ?? 'Contribution failed');
      }
    });
  }

  // ══════════ EXPENSE ══════════
  openExpense() {
    this.showExpense = true;
    this.expenseDescription = '';
    this.expenseDate = new Date().toISOString().slice(0, 10);
    this.expenseItems = [{ name: '', amount: null, categoryId: null }];
    if (this.categories.length === 0) {
      this.api.get<{ id: number; name: string }[]>(`groups/${this.groupId}/pool/categories`)
        .subscribe(c => this.categories = c);
    }
  }

  addExpenseItem() {
    this.expenseItems.push({ name: '', amount: null, categoryId: null });
  }

  removeExpenseItem(index: number) {
    this.expenseItems.splice(index, 1);
  }

  get expenseTotal(): number {
    return this.expenseItems.reduce((s, i) => s + (i.amount || 0), 0);
  }

  submitExpense() {
    const items = this.expenseItems
      .filter(i => i.amount !== null && i.amount > 0)
      .map(i => ({
        itemName: i.name.trim(),
        amount: i.amount,
        categoryId: i.categoryId
      }));
    if (items.length === 0 || !this.expenseDescription.trim()) return;
    this.savingExpense = true;
    this.api.post<{ message: string }>(`groups/${this.groupId}/pool/expenses`, {
      description: this.expenseDescription.trim(),
      expenseDate: this.expenseDate,
      items
    }).subscribe({
      next: () => {
        this.showExpense = false;
        this.savingExpense = false;
        this.load();
      },
      error: e => {
        this.savingExpense = false;
        alert(e.error?.message);
      }
    });
  }

  // ══════════ APPROVE / REJECT (admin) ══════════
  approve(c: PendingContribution) {
    this.api.post(`groups/this.groupId/pool/contributions/{this.groupId}/pool/contributions/this.groupId/pool/contributions/{c.id}/approve`, {})
      .subscribe({ next: () => this.load(), error: e => alert(e.error?.message) });
  }

  openReject(c: PendingContribution) {
    this.showRejectFor = c;
    this.rejectReason = '';
  }

  confirmReject() {
    const c = this.showRejectFor!;
    this.api.post(`groups/this.groupId/pool/contributions/{this.groupId}/pool/contributions/this.groupId/pool/contributions/{c.id}/reject`, { reason: this.rejectReason })
      .subscribe({
        next: () => { this.showRejectFor = null; this.load(); },
        error: e => alert(e.error?.message)
      });
  }

  // ══════════ SHARES (admin) ══════════
  openShares() {
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

  addAliasRow() {
    this.aliasMembers.push({ aliasName: '', monthlyShare: 0 });
  }

  saveShares() {
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
        next: () => { this.showShares = false; this.load(); },
        error: e => alert(e.error?.message)
      });
  }

  // ══════════ MONTHLY TARGET (admin) ══════════
  openTarget() {
    this.showTarget = true;
    this.targetInput = this.balance()?.monthlyTarget ?? 0;
  }

  saveTarget() {
    if (this.targetInput === null || this.targetInput < 0) return;
    this.savingTarget = true;
    this.api.put<{ message: string }>(`groups/${this.groupId}/pool/target`, {
      monthlyPoolTarget: this.targetInput
    }).subscribe({
      next: () => {
        this.showTarget = false;
        this.savingTarget = false;
        this.load();
      },
      error: e => {
        this.savingTarget = false;
        alert(e.error?.message);
      }
    });
  }

  filteredTransactions(): PoolTransaction[] {
    const all = this.balance()?.recentTransactions ?? [];
    const f = this.filter();
    return f === 'all' ? all : all.filter(t => t.type === f);
  }
}

export interface PoolBalance {
  isAdmin: boolean;
  pendingItems: PendingContribution[] | null;
  currentBalance: number;
  monthlyTarget: number;
  totalContributions: number;
  totalSpent: number;
  memberStatuses: MemberStatus[];
  recentTransactions: PoolTransaction[];
}
