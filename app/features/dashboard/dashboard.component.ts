import { Component, OnInit, inject, signal, ViewChild, ElementRef, AfterViewInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

interface ReceiptRow {
  id: number;
  name: string;
  price: number | null;
}

interface SettleModalData {
  name: string;
  upiId: string;
  amount: number;
}

export interface DashboardCategory {
  categoryId: number | null;
  categoryName: string;
  icon: string;
  totalAmount: number;
  itemCount: number;
  percentage: number;
}

export interface DashboardExpenseItem {
  itemName: string;
  quantity?: number;
  amount: number;
}

export interface DashboardExpense {
  id: number;
  description: string;
  totalAmount: number;
  expenseDate: string;
  paidByName: string;
  payerType: string;
  receiptUrl: string | null;
  items: DashboardExpenseItem[];
}

export interface DashboardUpcomingBill {
  billName: string;
  shareAmount: number;
  dueDay: number;
  isPaid: boolean;
}

export interface DashboardIouDebt {
  debtorId: number;
  debtorName: string;
  creditorId: number;
  creditorName: string;
  amount: number;
  creditorUpiId: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, AfterViewInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  @ViewChild('settleQrCanvas') settleQrCanvasRef?: ElementRef<HTMLCanvasElement>;

  groupId = '';
  me = this.auth.user;

  // Active Bucket Tab: 'daily' | 'bills' | 'iou'
  activeBucket = signal<'daily' | 'bills' | 'iou'>('daily');

  // KPI Data
  poolBalance = signal(0);
  poolTarget = signal(0);
  poolSpentThisMonth = signal(0);
  poolRemainingPercentage = signal(100);
  pendingBillsCount = signal(0);
  unpaidBillTotal = signal(0);
  netIouOwed = signal(0);
  unreadCount = signal(0);

  // Group Details
  groupName = signal('My Flat');
  groupAddress = signal('');
  memberCount = signal(1);

  // Dynamic Collections
  categoryBreakdown = signal<DashboardCategory[]>([]);
  recentExpenses = signal<DashboardExpense[]>([]);
  upcomingBills = signal<DashboardUpcomingBill[]>([]);
  iouDebts = signal<DashboardIouDebt[]>([]);

  // Filtered Debts
  theyOweMe = computed(() => {
    const myId = this.me()?.id;
    return this.iouDebts().filter(d => d.creditorId === myId);
  });

  iOweThem = computed(() => {
    const myId = this.me()?.id;
    return this.iouDebts().filter(d => d.debtorId === myId);
  });

  otherDebts = computed(() => {
    const myId = this.me()?.id;
    return this.iouDebts().filter(d => d.creditorId !== myId && d.debtorId !== myId);
  });

  totalTheyOweMe = computed(() => {
    return this.theyOweMe().reduce((sum, d) => sum + (d.amount || 0), 0);
  });

  totalIOweThem = computed(() => {
    return this.iOweThem().reduce((sum, d) => sum + (d.amount || 0), 0);
  });

  // Expanded receipt IDs
  expandedReceipts = signal<Set<string>>(new Set());

  // Receipt image modal preview
  selectedReceiptImage = signal<string | null>(null);

  // Toast feedback
  toastMessage = signal<string | null>(null);

  // ── UPI Settle Modal State ──
  settleModal = signal<SettleModalData | null>(null);

  ngOnInit(): void {
    this.groupId = this.route.snapshot.paramMap.get('groupId') || localStorage.getItem('rl_group_id') || '1';
    this.loadDashboardData();
  }

  ngAfterViewInit(): void {}

  loadDashboardData(): void {
    if (!this.groupId) return;
    this.api.get<any>(`groups/${this.groupId}/dashboard`).subscribe({
      next: (d) => {
        if (d) {
          if (d.groupName) this.groupName.set(d.groupName);
          if (d.groupAddress !== undefined) this.groupAddress.set(d.groupAddress);
          if (d.memberCount !== undefined) this.memberCount.set(d.memberCount);

          if (d.poolBalance !== undefined) this.poolBalance.set(d.poolBalance);
          if (d.monthlyPoolTarget !== undefined) this.poolTarget.set(d.monthlyPoolTarget);
          if (d.poolSpentThisMonth !== undefined) this.poolSpentThisMonth.set(d.poolSpentThisMonth);
          if (d.poolRemainingPercentage !== undefined) this.poolRemainingPercentage.set(d.poolRemainingPercentage);

          if (d.pendingBillsCount !== undefined) this.pendingBillsCount.set(d.pendingBillsCount);
          if (d.unpaidBillTotal !== undefined) this.unpaidBillTotal.set(d.unpaidBillTotal);

          // Net IOU = credit - debt
          const net = (d.outstandingIouCredit ?? 0) - (d.outstandingIouDebt ?? 0);
          this.netIouOwed.set(net);

          if (d.unreadNotifications !== undefined) this.unreadCount.set(d.unreadNotifications);

          this.categoryBreakdown.set(d.categoryBreakdown ?? []);
          this.recentExpenses.set(d.recentExpenses ?? []);
          this.upcomingBills.set(d.upcomingBills ?? []);
          this.iouDebts.set(d.iouDebts ?? []);
        }
      },
      error: (err) => {
        console.error('Failed to load dashboard data', err);
      }
    });
  }

  setBucket(bucket: 'daily' | 'bills' | 'iou'): void {
    this.activeBucket.set(bucket);
  }

  toggleReceipt(id: string | number): void {
    const key = String(id);
    const current = new Set(this.expandedReceipts());
    if (current.has(key)) {
      current.delete(key);
    } else {
      current.add(key);
    }
    this.expandedReceipts.set(current);
  }

  isReceiptExpanded(id: string | number): boolean {
    return this.expandedReceipts().has(String(id));
  }

  // ── Page Navigation & Expense Flow ──
  openExpenseModal(): void {
    this.goToPool('expense');
  }

  goToPool(action?: string): void {
    if (action) {
      this.router.navigate(['/g', this.groupId, 'pool'], { queryParams: { action } });
    } else {
      this.router.navigate(['/g', this.groupId, 'pool']);
    }
  }

  goToBills(): void {
    this.router.navigate(['/g', this.groupId, 'bills']);
  }

  goToIou(): void {
    this.router.navigate(['/g', this.groupId, 'iou']);
  }

  // ── UPI Settle Methods ──
  openSettleModal(name: string, upiId: string, amount: number): void {
    this.settleModal.set({ name, upiId, amount });
    setTimeout(() => this.drawSettleQr(upiId), 80);
  }

  closeSettleModal(): void {
    this.settleModal.set(null);
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

  getCategoryIcon(catName: string): string {
    if (!catName) return '📦';
    const lower = catName.toLowerCase();
    if (lower.includes('groc')) return '🥕';
    if (lower.includes('dair') || lower.includes('milk')) return '🥛';
    if (lower.includes('util') || lower.includes('bill') || lower.includes('elect')) return '⚡';
    if (lower.includes('clean') || lower.includes('house') || lower.includes('suppl')) return '🧴';
    if (lower.includes('food') || lower.includes('snack') || lower.includes('rest')) return '🍕';
    if (lower.includes('maint') || lower.includes('repair')) return '🔧';
    if (lower.includes('trav') || lower.includes('trans') || lower.includes('cab')) return '🚕';
    return '📦';
  }

  getCategoryColor(catName: string): string {
    if (!catName) return 'var(--p2)';
    const lower = catName.toLowerCase();
    if (lower.includes('groc')) return 'var(--ok)';
    if (lower.includes('dair') || lower.includes('milk')) return 'var(--p1)';
    if (lower.includes('util') || lower.includes('elect')) return 'var(--warn)';
    if (lower.includes('clean') || lower.includes('suppl')) return 'var(--err)';
    if (lower.includes('food')) return '#f97316';
    return 'var(--p2)';
  }

  getBillIcon(billName: string): string {
    if (!billName) return '📅';
    const lower = billName.toLowerCase();
    if (lower.includes('rent')) return '🏠';
    if (lower.includes('wifi') || lower.includes('net') || lower.includes('broad')) return '📶';
    if (lower.includes('elec') || lower.includes('power') || lower.includes('light')) return '⚡';
    if (lower.includes('maid') || lower.includes('clean')) return '🧹';
    if (lower.includes('water')) return '💧';
    if (lower.includes('gas')) return '🔥';
    return '📅';
  }

  drawSettleQr(text: string): void {
    const cv = this.settleQrCanvasRef?.nativeElement;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const sz = cv.width;
    const m = 21;
    const mod = sz / m;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sz, sz);

    let seed = 0;
    for (let i = 0; i < text.length; i++) {
      seed = (seed * 31 + text.charCodeAt(i)) & 0xffffff;
    }

    function rnd(x: number, y: number) {
      let s = seed ^ (x * 374761393) ^ (y * 1274126177);
      s = ((s >> 16) ^ s) * 0x45d9f3b;
      s = ((s >> 16) ^ s) * 0x45d9f3b;
      return (s >> 16) ^ s;
    }

    ctx.fillStyle = '#1A3330';
    for (let r = 0; r < m; r++) {
      for (let c = 0; c < m; c++) {
        const tl = r < 7 && c < 7;
        const tr = r < 7 && c >= m - 7;
        const bl = r >= m - 7 && c < 7;
        let dk = false;
        if (tl) {
          dk = (r === 0 || r === 6 || c === 0 || c === 6) || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        } else if (tr) {
          const lr = r, lc = c - (m - 7);
          dk = (lr === 0 || lr === 6 || lc === 0 || lc === 6) || (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4);
        } else if (bl) {
          const lr = r - (m - 7), lc = c;
          dk = (lr === 0 || lr === 6 || lc === 0 || lc === 6) || (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4);
        } else {
          dk = r === 6 || c === 6 ? (r + c) % 2 === 0 : (rnd(r, c) & 1) === 1;
        }
        if (dk) {
          ctx.fillRect(c * mod + 0.5, r * mod + 0.5, mod - 0.5, mod - 0.5);
        }
      }
    }

    ctx.fillStyle = '#1ABC9C';
    ctx.beginPath();
    ctx.arc(sz / 2, sz / 2, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RL', sz / 2, sz / 2);
  }

  showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(null), 3200);
  }

  goProfile(): void {
    this.router.navigate(['/profile']);
  }

  switchFlat(): void {
    this.router.navigate(['/']);
  }

  getInitials(name?: string): string {
    if (!name || !name.trim()) return 'DK';
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
}
