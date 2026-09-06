import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { MyBalance, DebtPair } from '../shared/models';
import { environment } from '../../environment/environment';

interface GroupMemberVm { id: string; name: string; isAdmin: boolean; }

@Component({
  selector: 'app-iou',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './iou.component.html'
})
export class IouComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private base = environment.apiUrl;

  groupId = '';
  balance = signal<MyBalance | null>(null);
  groupMembers = signal<GroupMemberVm[]>([]);
  showAdd = false;
  showSettle = false;

  description = '';
  amount: number | null = null;
  selectedMembers = signal<Set<string>>(new Set());

  settleTarget: DebtPair | null = null;
  settleAmount: number | null = null;
  settleNote = '';
  error = signal<string | null>(null);

  me = this.auth.user;

  ngOnInit() {
    this.groupId = this.route.snapshot.paramMap.get('groupId')!;
    this.load();

    this.api.get<any>(`groups/${this.groupId}/dashboard`)
      .subscribe(d => {
        const myId = this.auth.user()?.id;
        const members: GroupMemberVm[] = (d.members ?? [])
          .filter((m: GroupMemberVm) => Number(m.id) !== myId)
          .map((m: any) => ({ id: m.id, name: m.name, isAdmin: m.isAdmin }));
        this.groupMembers.set(members);
      });
  }

  load() {
    this.api.get<MyBalance>(`groups/${this.groupId}/iou/balance`)
      .subscribe(b => this.balance.set(b));
  }

  toggleMember(id: string) {
    const s = new Set(this.selectedMembers());
    s.has(id) ? s.delete(id) : s.add(id);
    this.selectedMembers.set(s);
  }

  addExpense() {
    const body = {
      description: this.description,
      amount: this.amount,
      paidById: this.me()!.id,
      expenseDate: new Date().toISOString().slice(0, 10),
      sharedWith: [...this.selectedMembers()]
    };
    this.api.post(`groups/${this.groupId}/iou/expenses`, body).subscribe({
      next: () => { this.showAdd = false; this.load(); this.resetForm(); },
      error: e => this.error.set(e.error?.message ?? 'Failed to add expense')
    });
  }

  openSettle(d: DebtPair) {
    this.settleTarget = d;
    this.settleAmount = d.amount;
    this.showSettle = true;
    this.error.set(null);
  }

  settleUp() {
    this.api.post(`groups/${this.groupId}/iou/settle-up`, {
      toUserId: this.settleTarget!.toUserId,
      amount: this.settleAmount,
      note: this.settleNote
    }).subscribe({
      next: () => { this.showSettle = false; this.load(); },
      error: e => this.error.set(e.error?.message ?? 'Settle-up failed')
    });
  }

  resetForm() {
    this.description = '';
    this.amount = null;
    this.selectedMembers.set(new Set());
    this.error.set(null);
  }

  abs(n: number) { return Math.abs(n); }
}
