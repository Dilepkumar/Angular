import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { MonthlyBillsOverview, BillSplit } from '../shared/models';

@Component({
  selector: 'app-bills',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './bills.component.html',
  styleUrls: ['./bills.component.scss']
})
export class BillsComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  groupId = '';
  groupName = signal('Apartment 402');
  overview = signal<MonthlyBillsOverview | null>(null);
  isAdmin = false;
  showAdd = false;
  toastMessage = signal<string | null>(null);

  billName = '';
  amount: number | null = null;
  billingMonth = new Date().toISOString().slice(0, 7);
  dueDay = 5;
  error = signal<string | null>(null);
  loading = signal(false);

  ngOnInit(): void {
    this.groupId = this.route.snapshot.paramMap.get('groupId') || localStorage.getItem('rl_group_id') || '1';
    this.load();

    this.api.get<any>(`groups/${this.groupId}`).subscribe({
      next: (g) => {
        if (g?.groupName) this.groupName.set(g.groupName);
        this.isAdmin = g?.myRole === 'Admin';
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
    if (n.includes('rent') || n.includes('room') || n.includes('flat')) return '🏠';
    if (n.includes('wifi') || n.includes('wi-fi') || n.includes('internet') || n.includes('fiber') || n.includes('broadband')) return '📶';
    if (n.includes('elect') || n.includes('power') || n.includes('current') || n.includes('eb')) return '⚡';
    if (n.includes('maid') || n.includes('clean') || n.includes('sweep')) return '🧹';
    if (n.includes('water') || n.includes('aqua')) return '💧';
    if (n.includes('gas') || n.includes('cylinder') || n.includes('lpg')) return '🔥';
    if (n.includes('cook') || n.includes('food') || n.includes('grocer') || n.includes('kitchen') || n.includes('milk')) return '🍳';
    if (n.includes('tv') || n.includes('dth') || n.includes('netflix') || n.includes('prime') || n.includes('stream')) return '📺';
    return '📋';
  }

  addBill(): void {
    if (!this.billName.trim() || !this.amount || this.amount <= 0) return;
    
    this.api.post(`groups/${this.groupId}/bills`, {
      billName: this.billName.trim(),
      amount: this.amount,
      billingMonth: `${this.billingMonth}-01`,
      dueDayOfMonth: this.dueDay || 5
    }).subscribe({
      next: () => {
        this.showAdd = false;
        this.billName = '';
        this.amount = null;
        this.showToast('✅ Bill created and split across roommates!');
        this.load();
      },
      error: (e) => this.error.set(e.error?.message ?? 'Failed to create bill')
    });
  }

  markPaid(split: any): void {
    if (!split.id) return;
    this.api.post(`groups/${this.groupId}/bills/splits/${split.id}/mark-paid`, {}).subscribe({
      next: () => {
        this.showToast('✅ Payment status updated!');
        this.load();
      },
      error: (e) => {
        this.showToast(`❌ ${e.error?.message || 'Failed to update payment status'}`);
      }
    });
  }

  sendReminder(bill: any): void {
    const id = bill.id || bill.billId;
    if (!id) return;
    this.api.post<any>(`groups/${this.groupId}/bills/${id}/remind`, {}).subscribe({
      next: (res) => {
        const count = res?.count ?? 0;
        this.showToast(res?.message || `📨 Reminder sent to ${count} flatmate(s)!`);
      },
      error: (e) => {
        this.showToast(e.error?.message || '📨 Reminder sent to pending flatmates!');
      }
    });
  }

  deleteBill(bill: any): void {
    if (!confirm(`Are you sure you want to deactivate "${bill.billName}"?`)) return;
    const id = bill.id || bill.billId;
    this.api.delete<any>(`groups/${this.groupId}/bills/${id}`).subscribe({
      next: () => {
        this.showToast(`🗑️ "${bill.billName}" deactivated`);
        this.load();
      },
      error: (e) => this.showToast(`❌ ${e.error?.message || 'Failed to deactivate bill'}`)
    });
  }

  generateNextMonth(): void {
    if (!confirm("Generate next month's recurring bills?")) return;
    this.api.post(`groups/${this.groupId}/bills/generate-next-month`, {}).subscribe({
      next: () => {
        this.showToast("✅ Next month's bills generated!");
        this.nextMonth();
      },
      error: (e) => this.showToast(`❌ ${e.error?.message || 'Failed to generate bills'}`)
    });
  }

  progress(bill: any): number {
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

  showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(null), 3200);
  }

  goToDashboard(): void {
    this.router.navigate(['/g', this.groupId, 'dashboard']);
  }
}
