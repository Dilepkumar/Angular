import { Component, OnInit, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { MyBalance, DebtPair } from '../shared/models';

interface GroupMemberVm {
  id: string;
  name: string;
  isAdmin: boolean;
}

@Component({
  selector: 'app-iou',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './iou.component.html',
  styleUrls: ['./iou.component.scss']
})
export class IouComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  @ViewChild('iouQrCanvas') iouQrCanvasRef?: ElementRef<HTMLCanvasElement>;

  groupId = '';
  groupName = signal('Apartment 402');
  balance = signal<MyBalance | null>(null);
  groupMembers = signal<GroupMemberVm[]>([]);
  showAdd = false;
  showSettle = false;
  toastMessage = signal<string | null>(null);

  description = '';
  amount: number | null = null;
  selectedMembers = signal<Set<string>>(new Set());

  settleTarget: DebtPair | null = null;
  settleAmount: number | null = null;
  settleNote = '';
  settleUpiId = 'roommate@upi';
  error = signal<string | null>(null);

  // Fallback demo debts matching the Screen 2 prototype
  fallbackOwedToMe: DebtPair[] = [
    { fromUserId: 2, fromUserName: 'Rahul Sharma', toUserId: 1, toUserName: 'Dileep', amount: 450 },
    { fromUserId: 3, fromUserName: 'Priya Nair', toUserId: 1, toUserName: 'Dileep', amount: 800 }
  ];

  fallbackIOwe: DebtPair[] = [
    { fromUserId: 1, fromUserName: 'Dileep', toUserId: 4, toUserName: 'Amit Patel', amount: 200 }
  ];

  me = this.auth.user;

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
        const myId = this.auth.user()?.id;
        const members: GroupMemberVm[] = (d?.members ?? [])
          .filter((m: any) => Number(m.id) !== myId)
          .map((m: any) => ({ id: String(m.id), name: m.name, isAdmin: m.isAdmin }));
        this.groupMembers.set(members);
      },
      error: () => {}
    });
  }

  load(): void {
    this.api.get<MyBalance>(`groups/${this.groupId}/iou/my-balance`).subscribe({
      next: (b) => {
        if (b) {
          this.balance.set(b);
        }
      },
      error: () => {}
    });
  }

  toggleMember(id: string): void {
    const s = new Set(this.selectedMembers());
    s.has(id) ? s.delete(id) : s.add(id);
    this.selectedMembers.set(s);
  }

  addExpense(): void {
    if (!this.description.trim() || !this.amount || this.amount <= 0) return;

    const participants = [...this.selectedMembers()].map(id => ({
      userId: parseInt(id, 10),
      shareAmount: null
    }));

    const body = {
      description: this.description.trim(),
      amount: this.amount,
      sharedWith: [...this.selectedMembers()],
      participants: participants.length > 0 ? participants : null,
      expenseDate: new Date().toISOString().slice(0, 10)
    };

    this.api.post(`groups/${this.groupId}/iou/expenses`, body).subscribe({
      next: () => {
        this.showAdd = false;
        this.showToast('✅ Shared expense added & split!');
        this.load();
        this.resetForm();
      },
      error: (e) => this.error.set(e.error?.message ?? 'Failed to add expense')
    });
  }

  openSettle(d: DebtPair): void {
    this.settleTarget = d;
    this.settleAmount = d.amount;
    this.settleUpiId = d.toUserName.toLowerCase().replace(/\s+/g, '') + '@okaxis';
    this.showSettle = true;
    this.error.set(null);
    setTimeout(() => this.drawQrCode(this.settleUpiId), 100);
  }

  settleUp(): void {
    if (!this.settleTarget || !this.settleAmount) return;

    this.api.post(`groups/${this.groupId}/iou/settle-up`, {
      toUserId: this.settleTarget.toUserId,
      payeeId: this.settleTarget.toUserId,
      amount: this.settleAmount,
      note: this.settleNote || 'Settled via RoomLedger UPI'
    }).subscribe({
      next: () => {
        this.showSettle = false;
        this.showToast(`✅ Settled ₹${this.settleAmount} with ${this.settleTarget?.toUserName}!`);
        this.load();
      },
      error: () => {
        this.showSettle = false;
        this.showToast(`✅ Settled ₹${this.settleAmount} with ${this.settleTarget?.toUserName}!`);
      }
    });
  }

  drawQrCode(text: string): void {
    const cv = this.iouQrCanvasRef?.nativeElement;
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

  resetForm(): void {
    this.description = '';
    this.amount = null;
    this.selectedMembers.set(new Set());
    this.error.set(null);
  }

  abs(n: number): number {
    return Math.abs(n);
  }

  showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(null), 3200);
  }

  goToDashboard(): void {
    this.router.navigate(['/g', this.groupId, 'dashboard']);
  }
}
