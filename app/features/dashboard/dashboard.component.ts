import { Component, OnInit, inject, signal, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

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

  // KPI Data (Dynamic with smart fallbacks matching prototype)
  poolBalance = signal(14500);
  poolTarget = signal(20000);
  pendingBillsCount = signal(2);
  netIouOwed = signal(1850);
  unreadCount = signal(3);

  // Group Details
  groupName = signal('Apartment 402');
  groupAddress = signal('HSR Layout, Bangalore');
  memberCount = signal(7);

  // Expanded receipt IDs
  expandedReceipts = signal<Set<string>>(new Set());

  // Toast feedback
  toastMessage = signal<string | null>(null);

  // ── Log Expense Modal State ──
  showExpenseModal = signal(false);
  expensePayer = signal<'pool' | 'me'>('pool');
  expenseBucket = signal<'daily' | 'bills' | 'iou'>('daily');
  expenseName = 'Supermarket Run';
  expenseCategory = '🥕 Groceries';
  expenseTotal = 850;
  expenseRows: ReceiptRow[] = [
    { id: 1, name: 'Milk', price: 200 },
    { id: 2, name: 'Vegetables', price: 350 },
    { id: 3, name: 'Detergent', price: 300 }
  ];
  rowCounter = 3;
  splitWith = signal<{ id: string; name: string; initials: string; selected: boolean }[]>([
    { id: '1', name: 'Rahul', initials: 'RK', selected: true },
    { id: '2', name: 'Priya', initials: 'PR', selected: true },
    { id: '3', name: 'Amit', initials: 'AM', selected: false }
  ]);

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
          if (d.poolBalance !== undefined) this.poolBalance.set(d.poolBalance);
          if (d.unreadNotifications !== undefined) this.unreadCount.set(d.unreadNotifications);
          if (d.outstandingIouCredit !== undefined && d.outstandingIouCredit > 0) {
            this.netIouOwed.set(d.outstandingIouCredit);
          }
        }
      },
      error: () => {}
    });
  }

  setBucket(bucket: 'daily' | 'bills' | 'iou'): void {
    this.activeBucket.set(bucket);
  }

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

  // ── Page Navigation & Expense Flow ──
  openExpenseModal(): void {
    // Navigate directly to Pool Page with action=expense as requested
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

  closeExpenseModal(): void {
    this.showExpenseModal.set(false);
  }

  addRow(): void {
    this.rowCounter++;
    this.expenseRows.push({ id: this.rowCounter, name: '', price: null });
  }

  removeRow(id: number): void {
    this.expenseRows = this.expenseRows.filter(r => r.id !== id);
  }

  get itemsSum(): number {
    return this.expenseRows.reduce((acc, r) => acc + (r.price || 0), 0);
  }

  get isReceiptBalanced(): boolean {
    return Math.abs(this.expenseTotal - this.itemsSum) < 0.01;
  }

  get receiptMismatchDiff(): number {
    return Math.abs(this.expenseTotal - this.itemsSum);
  }

  toggleSplitParticipant(id: string): void {
    this.splitWith.update(list =>
      list.map(p => p.id === id ? { ...p, selected: !p.selected } : p)
    );
  }

  submitExpense(): void {
    if (this.expenseRows.length && !this.isReceiptBalanced) {
      this.showToast('⚠️ Please balance receipt items with total spend first');
      return;
    }

    this.showToast(`✅ ₹${this.expenseTotal} logged to Daily Pool!`);
    this.poolBalance.update(b => Math.max(0, b - this.expenseTotal));
    this.closeExpenseModal();
  }

  // ── UPI Settle Methods ──
  openSettleModal(name: string, upiId: string, amount: number): void {
    this.settleModal.set({ name, upiId, amount });
    setTimeout(() => this.drawSettleQr(upiId), 80);
  }

  closeSettleModal(): void {
    this.settleModal.set(null);
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
}
