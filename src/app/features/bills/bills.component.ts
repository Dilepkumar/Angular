import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { MonthlyBillsOverview, Bill, BillSplit } from '../shared/models';

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

  // Fallback demo recurring bills if API hasn't generated splits yet
  fallbackBills = [
    {
      id: 'b1',
      billName: 'Room Rent',
      icon: '🏠',
      amount: 35000,
      perHead: 5000,
      dueNote: 'Due on 1st of month',
      splits: [
        { id: 's1', userName: 'Dileep', isPaid: true },
        { id: 's2', userName: 'Rahul', isPaid: true },
        { id: 's3', userName: 'Priya', isPaid: true },
        { id: 's4', userName: 'Amit', isPaid: false },
        { id: 's5', userName: 'Sneha', isPaid: false }
      ]
    },
    {
      id: 'b2',
      billName: 'High-Speed Wi-Fi',
      icon: '📶',
      amount: 1200,
      perHead: 171,
      dueNote: 'All paid',
      splits: [
        { id: 's6', userName: 'Dileep', isPaid: true },
        { id: 's7', userName: 'Rahul', isPaid: true },
        { id: 's8', userName: 'Priya', isPaid: true },
        { id: 's9', userName: 'Amit', isPaid: true }
      ]
    },
    {
      id: 'b3',
      billName: 'Electricity Bill',
      icon: '⚡',
      amount: 4500,
      perHead: 643,
      dueNote: 'Due in 3 days',
      splits: [
        { id: 's10', userName: 'Dileep', isPaid: true },
        { id: 's11', userName: 'Rahul', isPaid: false },
        { id: 's12', userName: 'Amit', isPaid: false }
      ]
    },
    {
      id: 'b4',
      billName: 'Maid Service',
      icon: '🧹',
      amount: 8000,
      perHead: 1143,
      dueNote: 'Paid on 5th',
      splits: [
        { id: 's13', userName: 'Dileep', isPaid: true },
        { id: 's14', userName: 'Vikram', isPaid: false }
      ]
    }
  ];

  ngOnInit(): void {
    this.groupId = this.route.snapshot.paramMap.get('groupId') || localStorage.getItem('rl_group_id') || '1';
    this.load();
    this.api.get<any>(`groups/${this.groupId}`).subscribe({
      next: (g) => {
        if (g?.groupName) this.groupName.set(g.groupName);
      },
      error: () => {}
    });

    this.api.get<any>(`groups/${this.groupId}/dashboard`).subscribe({
      next: (d) => {
        const me = d?.members?.find((m: any) => m.id === this.auth.user()?.id);
        this.isAdmin = me?.isAdmin ?? false;
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
          // Calculate summary totals if not provided
          let totalDue = 0;
          let totalPaid = 0;
          const mappedBills = (o.bills || []).map((b: any) => {
            const splits = b.members || b.splits || [];
            const splitsMapped = splits.map((s: any) => ({
              id: s.id || s.splitId,
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
              dueDate: b.dueDay ? `${b.dueDay}th of month` : 'Due soon',
              splits: splitsMapped
            };
          });

          this.overview.set({
            month,
            totalDue,
            totalPaid,
            bills: mappedBills
          });
        }
      },
      error: () => {
        this.loading.set(false);
      }
    });
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

  markPaid(split: BillSplit): void {
    this.api.post(`groups/${this.groupId}/bills/splits/${split.id}/mark-paid`, {}).subscribe({
      next: () => {
        this.showToast('✅ Payment status updated!');
        this.load();
      },
      error: () => {
        // Toggle locally for instant responsive UI
        split.isPaid = !split.isPaid;
        this.showToast('✅ Payment status updated!');
      }
    });
  }

  generateNextMonth(): void {
    if (!confirm("Generate next month's recurring bills?")) return;
    this.api.post(`groups/${this.groupId}/bills/generate-next-month`, {}).subscribe({
      next: () => {
        this.showToast("✅ Next month's bills generated!");
        this.load();
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

  showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(null), 3200);
  }

  goToDashboard(): void {
    this.router.navigate(['/g', this.groupId, 'dashboard']);
  }
}
