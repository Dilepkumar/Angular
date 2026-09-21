import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { PopupService } from '../../core/services/popup.service';
import { MonthlyBillsOverview, BillSplit } from '../shared/models';

@Component({
  selector: 'app-bills',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bills.component.html',
  styleUrls: ['./bills.component.scss']
})
export class BillsComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private popup = inject(PopupService);

  groupId = '';
  groupName = signal('Apartment 402');
  overview = signal<MonthlyBillsOverview | null>(null);
  isAdmin = false;
  showAdd = false;

  // Add bill form state
  billName = '';
  amount: number | null = null;
  billingMonth = new Date().toISOString().slice(0, 7);
  dueDay = 5;
  payFromPool = signal<boolean>(false);
  currentPoolBalance = signal<number>(0);

  loading = signal(false);

  ngOnInit(): void {
    this.groupId = this.route.snapshot.paramMap.get('groupId') || localStorage.getItem('rl_group_id') || '1';
    this.load();
    this.loadPoolBalance();

    this.api.get<any>(`groups/${this.groupId}`).subscribe({
      next: (g) => {
        if (g?.groupName) this.groupName.set(g.groupName);
        this.isAdmin = g?.myRole === 'Admin';
      },
      error: () => {}
    });
  }

  loadPoolBalance(): void {
    this.api.get<any>(`groups/${this.groupId}/pool/balance`).subscribe({
      next: (b) => {
        this.currentPoolBalance.set(b?.currentBalance ?? 0);
      },
      error: () => {}
    });
  }

  load(): void {
    this.loading.set(true);
    const month = this.billingMonth || new Date().toISOString().slice(0, 7);
    this.api.get<any>(`groups/${this.groupId}/bills?month=${month}`).subscribe({
      next: (o) => {
        this.loading.set(false);
        if (o && o.bills) {
          let totalDue = 0;
          let totalPaid = 0;
          const mappedBills = (o.bills || []).map((b: any) => {
            const splits = b.members || b.splits || [];
            const splitsMapped = splits.map((s: any) => ({
              id: String(s.id || s.splitId),
              userId: s.userId,
              userName: s.userName || 'Roommate',
              shareAmount: s.shareAmount || b.perHead || 0,
              isPaid: s.isPaid ?? false
            }));
            const paidSum = splitsMapped.filter((s: any) => s.isPaid).reduce((acc: number, s: any) => acc + s.shareAmount, 0);
            const dueSum = splitsMapped.filter((s: any) => !s.isPaid).reduce((acc: number, s: any) => acc + s.shareAmount, 0);
            totalPaid += paidSum;
            totalDue += dueSum;

            return {
              id: String(b.billId || b.id),
              billName: b.billName,
              amount: b.totalAmount || b.amount,
              dueDate: b.dueDay ? `Due on ${b.dueDay}th of month` : 'Due this month',
              paidFromPool: b.paidFromPool ?? false,
              splits: splitsMapped
            };
          });

          this.overview.set({
            month,
            totalDue,
            totalPaid,
            bills: mappedBills
          });
        } else {
          this.overview.set({
            month,
            totalDue: 0,
            totalPaid: 0,
            bills: []
          });
        }
      },
      error: () => {
        this.loading.set(false);
        this.overview.set({
          month,
          totalDue: 0,
          totalPaid: 0,
          bills: []
        });
      }
    });
  }

  prevMonth(): void {
    const [y, m] = this.billingMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    this.billingMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    this.load();
  }

  nextMonth(): void {
    const [y, m] = this.billingMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    this.billingMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    this.load();
  }

  formattedMonth(): string {
    if (!this.billingMonth) return '';
    const [y, m] = this.billingMonth.split('-').map(Number);
    const date = new Date(y, m - 1, 1);
    return date.toLocaleString('default', { month: 'short', year: 'numeric' });
  }

  billIcon(name: string): string {
    const n = (name || '').toLowerCase();
    if (n.includes('rent') || n.includes('room') || n.includes('flat')) return 'fa-solid fa-house';
    if (n.includes('wifi') || n.includes('wi-fi') || n.includes('internet') || n.includes('fiber') || n.includes('broadband')) return 'fa-solid fa-wifi';
    if (n.includes('elect') || n.includes('power') || n.includes('current') || n.includes('eb')) return 'fa-solid fa-bolt';
    if (n.includes('maid') || n.includes('clean') || n.includes('sweep')) return 'fa-solid fa-broom';
    if (n.includes('water') || n.includes('aqua')) return 'fa-solid fa-droplet';
    if (n.includes('gas') || n.includes('cylinder') || n.includes('lpg')) return 'fa-solid fa-fire';
    if (n.includes('cook') || n.includes('food') || n.includes('grocer') || n.includes('kitchen') || n.includes('milk')) return 'fa-solid fa-utensils';
    if (n.includes('tv') || n.includes('dth') || n.includes('netflix') || n.includes('prime') || n.includes('stream')) return 'fa-solid fa-tv';
    return 'fa-solid fa-receipt';
  }

  openAddModal(): void {
    this.showAdd = true;
    this.loadPoolBalance();
  }

  async addBill(): Promise<void> {
    if (!this.billName.trim()) {
      this.popup.warning('Please enter a bill name (e.g. Wi-Fi, Electricity, Maid).');
      return;
    }
    if (!this.amount || this.amount <= 0) {
      this.popup.warning('Please enter a valid bill amount greater than zero.');
      return;
    }

    if (this.payFromPool() && this.amount > this.currentPoolBalance()) {
      const proceed = await this.popup.confirm({
        title: 'Low Pool Balance',
        message: `The bill amount (₹${this.amount}) exceeds the current pool balance (₹${this.currentPoolBalance()}). Do you still want to deduct it from the pool?`,
        confirmText: 'Pay from Pool Anyway',
        cancelText: 'Cancel',
        type: 'warning'
      });
      if (!proceed) return;
    }

    this.api.post<any>(`groups/${this.groupId}/bills`, {
      billName: this.billName.trim(),
      amount: this.amount,
      billingMonth: `${this.billingMonth}-01`,
      dueDayOfMonth: this.dueDay || 5,
      payFromPool: this.payFromPool()
    }).subscribe({
      next: (res) => {
        this.showAdd = false;
        this.billName = '';
        this.amount = null;
        this.payFromPool.set(false);
        this.popup.success(res?.message || '✅ Bill successfully created!');
        this.load();
        this.loadPoolBalance();
      },
      error: (e) => this.popup.error(e.error?.message ?? 'Failed to create bill')
    });
  }

  markPaid(split: any): void {
    if (!split.id) return;
    this.api.post(`groups/${this.groupId}/bills/splits/${split.id}/mark-paid`, {}).subscribe({
      next: () => {
        this.popup.success('✅ Payment status updated!');
        this.load();
      },
      error: (e) => {
        this.popup.error(`❌ ${e.error?.message || 'Failed to update payment status'}`);
      }
    });
  }

  sendReminder(bill: any): void {
    const id = bill.id || bill.billId;
    if (!id) return;
    this.api.post<any>(`groups/${this.groupId}/bills/${id}/remind`, {}).subscribe({
      next: (res) => {
        const count = res?.count ?? 0;
        this.popup.success(res?.message || `📨 Reminder sent to ${count} flatmate(s)!`);
      },
      error: (e) => {
        this.popup.error(e.error?.message || 'Failed to send reminder to pending flatmates.');
      }
    });
  }

  async deleteBill(bill: any): Promise<void> {
    const confirmed = await this.popup.confirm({
      title: 'Deactivate Bill',
      message: `Are you sure you want to deactivate "${bill.billName}"? This will stop recurring splits for future months.`,
      confirmText: 'Deactivate',
      cancelText: 'Keep Active',
      type: 'danger'
    });
    if (!confirmed) return;

    const id = bill.id || bill.billId;
    this.api.delete<any>(`groups/${this.groupId}/bills/${id}`).subscribe({
      next: () => {
        this.popup.success(`🗑️ "${bill.billName}" deactivated`);
        this.load();
      },
      error: (e) => this.popup.error(`❌ ${e.error?.message || 'Failed to deactivate bill'}`)
    });
  }

  async generateNextMonth(): Promise<void> {
    const confirmed = await this.popup.confirm({
      title: 'Generate Next Month Bills',
      message: "Generate recurring bills and member splits for next month?",
      confirmText: 'Generate Now',
      cancelText: 'Cancel',
      type: 'primary'
    });
    if (!confirmed) return;

    this.api.post(`groups/${this.groupId}/bills/generate-next-month`, {}).subscribe({
      next: () => {
        this.popup.success("✅ Next month's bills generated!");
        this.nextMonth();
      },
      error: (e) => this.popup.error(`❌ ${e.error?.message || 'Failed to generate bills'}`)
    });
  }

  progress(bill: any): number {
    if (bill.paidFromPool) return 100;
    const splits = bill.splits ?? [];
    if (!splits.length) return 0;
    const paid = splits.filter((s: any) => s.isPaid).length;
    return Math.round((paid / splits.length) * 100);
  }

  isMine(s: any): boolean {
    return s.userId === this.auth.user()?.id;
  }

  canMark(s: any): boolean {
    return this.isAdmin || this.isMine(s);
  }

  goToDashboard(): void {
    this.router.navigate(['/g', this.groupId, 'dashboard']);
  }
}
