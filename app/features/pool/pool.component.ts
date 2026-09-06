import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { PoolBalance, Category } from '../shared/models';

@Component({
  selector: 'app-pool',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DatePipe],   // ✅ FormsModule HERE
  templateUrl: './pool.component.html'
})
export class PoolComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  groupId = '';
  pool = signal<PoolBalance | null>(null);
  categories = signal<Category[]>([]);              // ← only ONE declaration
  showContribute = false;
  showExpense = false;                              // ✅ HERE

  amount: number | null = null;
  txnRef = '';

  description = '';
  expenseDate = new Date().toISOString().slice(0, 10);
  items = signal<{ categoryId: string; itemName: string; amount: number | null }[]>([]);
  error = signal<string | null>(null);
  me = this.auth.user;

  ngOnInit() {
    this.groupId = this.route.snapshot.paramMap.get('groupId')!;
    this.load();
    this.api.get<Category[]>(`groups/${this.groupId}/pool/categories`)
      .subscribe(c => this.categories.set(c));
  }

  load() {
    this.api.get<PoolBalance>(`groups/${this.groupId}/pool/balance`)
      .subscribe(p => this.pool.set(p));
  }

  openExpense() {                                    // ✅ HERE
    this.showExpense = true;
    this.error.set(null);
  }

  addItem() { this.items.update(a => [...a, { categoryId: '', itemName: '', amount: null }]); }
  removeItem(i: number) { this.items.update(a => a.filter((_, idx) => idx !== i)); }
  itemsTotal() { return this.items().reduce((s, it) => s + (it.amount ?? 0), 0); }
  expenseTotal() { return this.itemsTotal(); }       // ✅ HERE

  contribute() {
    this.api.post(`groups/${this.groupId}/pool/contribute`, {
      amount: this.amount,
      periodMonth: new Date().toISOString().slice(0, 10),
      transactionRef: this.txnRef
    }).subscribe({
      next: () => { this.showContribute = false; this.amount = null; this.load(); },
      error: e => this.error.set(e.error?.message)
    });
  }

  addExpense() {
    if (this.itemsTotal() <= 0) {
      this.error.set('Add at least one item with an amount');
      return;
    }
    const body = {
      description: this.description,
      totalAmount: this.itemsTotal(),
      expenseDate: this.expenseDate,
      items: this.items().map(it => ({
        categoryId: it.categoryId || null,
        itemName: it.itemName,
        amount: it.amount
      }))
    };
    this.api.post(`groups/${this.groupId}/pool/expenses`, body).subscribe({
      next: () => { this.showExpense = false; this.resetForm(); this.load(); },
      error: e => this.error.set(e.error?.message)
    });
  }

  resetForm() {
    this.description = '';
    this.items.set([]);
    this.error.set(null);
  }
}
