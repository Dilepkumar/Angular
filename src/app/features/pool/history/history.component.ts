import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

export interface PoolHistoryTransaction {
  id: string;
  type: 'Contribution' | 'Expense';
  description: string;
  userName: string;
  date: string;
  amount: number;
  status: string;
  payerType: 'member' | 'pool';
  payerName?: string;
  recorderName?: string;
  receiptUrl?: string | null;
  category?: string | null;
  isReimbursed?: boolean;
  items?: Array<{ id: number; itemName: string; quantity?: number; amount: number }>;
}

export interface PoolHistoryResponse {
  period: string;
  fromDate?: string;
  toDate?: string;
  totalIn: number;
  totalOut: number;
  netChange: number;
  totalCount: number;
  transactions: PoolHistoryTransaction[];
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss']
})
export class HistoryComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  groupId = '1';

  // Period state
  historyPeriod = signal<'daily' | 'weekly' | 'monthly' | 'custom'>('monthly');
  historyFromDate = '';
  historyToDate = '';

  // Type filter
  filter = signal<'all' | 'Contribution' | 'Expense'>('all');
  filters: ('all' | 'Contribution' | 'Expense')[] = ['all', 'Contribution', 'Expense'];

  // Search filter
  searchQuery = signal<string>('');

  // Data & loading
  historyData = signal<PoolHistoryResponse | null>(null);
  historyLoading = signal<boolean>(false);

  // Accordion state
  expandedReceipts = signal<Set<string>>(new Set<string>());

  // Receipt modal viewer
  selectedReceiptImage = signal<string | null>(null);

  // Reimbursement state
  reimbursingOutOfPocket = signal<boolean>(false);
  toastMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.groupId = this.route.snapshot.paramMap.get('groupId') ||
                   this.route.parent?.snapshot.paramMap.get('groupId') ||
                   localStorage.getItem('rl_group_id') || '1';

    // Set default custom dates if needed
    const today = new Date();
    this.historyToDate = today.toISOString().slice(0, 10);
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    this.historyFromDate = firstDay.toISOString().slice(0, 10);

    this.loadHistory();
    this.checkAdminStatus();
  }

  get me() {
    return this.auth.user();
  }

  isAdmin = signal<boolean>(false);

  checkAdminStatus(): void {
    this.api.get<{ isAdmin?: boolean }>(`groups/${this.groupId}/pool/balance`).subscribe({
      next: (b) => this.isAdmin.set(b?.isAdmin ?? false),
      error: () => this.isAdmin.set(false)
    });
  }

  setHistoryPeriod(period: 'daily' | 'weekly' | 'monthly' | 'custom'): void {
    this.historyPeriod.set(period);
    if (period !== 'custom') {
      this.loadHistory();
    }
  }

  setFilter(f: 'all' | 'Contribution' | 'Expense'): void {
    this.filter.set(f);
  }

  loadHistory(): void {
    this.historyLoading.set(true);
    let params = `period=${this.historyPeriod()}`;
    if (this.historyPeriod() === 'custom') {
      if (this.historyFromDate) params += `&fromDate=${this.historyFromDate}`;
      if (this.historyToDate) params += `&toDate=${this.historyToDate}`;
    }

    this.api.get<PoolHistoryResponse>(`groups/${this.groupId}/pool/history?${params}`).subscribe({
      next: (data) => {
        this.historyData.set(data);
        this.historyLoading.set(false);
      },
      error: (e) => {
        this.showToast(`❌ ${e.error?.message || 'Failed to load ledger history'}`);
        this.historyLoading.set(false);
      }
    });
  }

  // Filtered transactions computation
  filteredTransactions = computed(() => {
    const data = this.historyData();
    if (!data || !data.transactions) return [];

    let list = data.transactions;
    const f = this.filter();
    if (f !== 'all') {
      list = list.filter(t => t.type === f);
    }

    const q = this.searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter(t =>
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.userName && t.userName.toLowerCase().includes(q)) ||
        (t.payerName && t.payerName.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q)) ||
        (t.items && t.items.some(i => i.itemName.toLowerCase().includes(q)))
      );
    }

    return list;
  });

  // Dynamic summary metrics
  summaryMetrics = computed(() => {
    const rawData = this.historyData();
    if (!rawData) {
      return { totalIn: 0, totalOut: 0, netChange: 0, count: 0 };
    }
    // If no search filter, use backend period aggregates
    if (!this.searchQuery().trim() && this.filter() === 'all') {
      return {
        totalIn: rawData.totalIn,
        totalOut: rawData.totalOut,
        netChange: rawData.netChange,
        count: rawData.totalCount
      };
    }

    // Otherwise compute from filtered view
    const list = this.filteredTransactions();
    const totalIn = list.filter(t => t.type === 'Contribution').reduce((acc, t) => acc + (t.amount || 0), 0);
    const totalOut = list.filter(t => t.type === 'Expense').reduce((acc, t) => acc + (t.amount || 0), 0);
    return {
      totalIn,
      totalOut,
      netChange: totalIn - totalOut,
      count: list.length
    };
  });

  // Accordion toggling
  toggleReceipt(id: string): void {
    const current = new Set(this.expandedReceipts());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.expandedReceipts.set(current);
  }

  isReceiptExpanded(id: string): boolean {
    return this.expandedReceipts().has(id);
  }

  expandAll(): void {
    const set = new Set<string>();
    this.filteredTransactions().forEach(t => set.add(t.id));
    this.expandedReceipts.set(set);
  }

  collapseAll(): void {
    this.expandedReceipts.set(new Set<string>());
  }

  // Receipt image lightbox
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

  // Reimburse out-of-pocket directly from history
  reimburseOutOfPocket(expenseId?: number): void {
    this.reimbursingOutOfPocket.set(true);
    this.api.post<{ message: string; reimbursedAmount?: number }>(
      `groups/${this.groupId}/pool/reimburse-out-of-pocket`,
      { expenseId }
    ).subscribe({
      next: (res) => {
        this.reimbursingOutOfPocket.set(false);
        this.showToast(`✅ ${res.message || 'Expense reimbursed from Central Room Pool!'}`);
        this.loadHistory();
      },
      error: (e) => {
        this.reimbursingOutOfPocket.set(false);
        this.showToast(`❌ ${e.error?.message || 'Failed to reimburse expense'}`);
      }
    });
  }

  // Category visual helpers
  getCategoryIcon(category?: string | null): string {
    const cat = (category || '').toLowerCase();
    if (cat.includes('grocer') || cat.includes('veg')) return '🥕';
    if (cat.includes('dairy') || cat.includes('milk')) return '🥛';
    if (cat.includes('utilit') || cat.includes('bill') || cat.includes('wifi') || cat.includes('power')) return '⚡';
    if (cat.includes('clean') || cat.includes('house')) return '🧴';
    if (cat.includes('food') || cat.includes('snack') || cat.includes('dinner')) return '🍕';
    if (cat.includes('maint') || cat.includes('repair')) return '🔧';
    if (cat.includes('travel') || cat.includes('cab') || cat.includes('auto')) return '🚕';
    return '📦';
  }

  getCategoryColor(category?: string | null): string {
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

  // Navigation
  goBack(): void {
    this.router.navigate(['/g', this.groupId, 'pool']);
  }

  goToLogExpense(): void {
    this.router.navigate(['/g', this.groupId, 'log-expense']);
  }

  showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      if (this.toastMessage() === msg) {
        this.toastMessage.set(null);
      }
    }, 3500);
  }
}
