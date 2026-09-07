import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { MonthlyBillsOverview, Bill, BillSplit } from '../shared/models';

@Component({
  selector: 'app-bills',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DatePipe],
  templateUrl: './bills.component.html'
})
export class BillsComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  groupId = '';
  overview = signal<MonthlyBillsOverview | null>(null);
  isAdmin = false;
  showAdd = false;

  billName = '';
  amount: number | null = null;
  billingMonth = new Date().toISOString().slice(0, 7);
  dueDate = '';
  error = signal<string | null>(null);

  ngOnInit() {
  this.groupId = this.route.snapshot.paramMap.get('groupId')!;
  this.load();
  this.api.get<any>(`groups/${this.groupId}/dashboard`)
    .subscribe({
      next: d => {
        const me = d?.members?.find((m: any) => m.id === this.auth.user()?.id);
        this.isAdmin = me?.isAdmin ?? false;
      },
      error: e => console.error('dashboard failed', e)
    });
  }

  load() {
    const month = new Date().toISOString().slice(0, 7);
    this.api.get<MonthlyBillsOverview>(`groups/this.groupId/bills?month={this.groupId}/bills?month=this.groupId/bills?month={month}`)
      .subscribe({
        next: o => this.overview.set(o),
        error: e => console.error('bills failed', e)
      });
  }

  addBill() {
    this.api.post(`groups/${this.groupId}/bills`, {
      billName: this.billName,
      amount: this.amount,
      billingMonth: `${this.billingMonth}-01`,
      dueDate: this.dueDate,
      splitRule: 'Equal'
    }).subscribe({
      next: () => {
        this.showAdd = false;
        this.billName = '';
        this.amount = null;
        this.load();
      },
      error: e => this.error.set(e.error?.message ?? 'Failed to create bill')
    });
  }

  markPaid(split: BillSplit) {
    this.api.put(`groups/this.groupId/bills/splits/{this.groupId}/bills/splits/this.groupId/bills/splits/{split.id}/mark-paid`, {})
      .subscribe(() => this.load());
  }

  generateNextMonth() {
    if (!confirm("Generate next month's recurring bills?")) return;
    this.api.post(`groups/${this.groupId}/bills/generate-next-month`, {})
      .subscribe({
        next: () => alert('✅ Next month bills created!'),
        error: e => alert(e.error?.message)
      });
  }

  progress(bill: Bill): number {
  const splits = bill.splits ?? [];
  const paid = splits.filter((s: BillSplit) => s.isPaid).length;
  return splits.length ? Math.round((paid / splits.length) * 100) : 0;
}

  progressClass(p: number) {
    return p === 100 ? 'bg-emerald-100 text-emerald-700'
         : p > 0 ? 'bg-amber-100 text-amber-700'
         : 'bg-red-100 text-red-700';
  }

  isMine(s: BillSplit) {
    return s.userId === this.auth.user()?.id;
  }
}
