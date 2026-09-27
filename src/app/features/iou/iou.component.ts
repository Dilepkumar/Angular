import { Component, OnInit, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { PopupService } from '../../core/services/popup.service';
import { MyBalance, DebtPair } from '../shared/models';
import * as QRCode from 'qrcode';

interface GroupMemberVm {
  id: string;
  name: string;
  isAdmin: boolean;
}

@Component({
  selector: 'app-iou',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe, RouterLink],
  templateUrl: './iou.component.html',
  styleUrls: ['./iou.component.scss']
})
export class IouComponent implements OnInit {
  private api = inject(ApiService);
  auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private popup = inject(PopupService);

  @ViewChild('iouQrCanvas') iouQrCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('myQrCanvas') myQrCanvasRef?: ElementRef<HTMLCanvasElement>;

  groupId = '';
  groupName = signal('Apartment 402');
  balance = signal<MyBalance | null>(null);
  groupMembers = signal<GroupMemberVm[]>([]);
  expenses = signal<any[]>([]);
  showAdd = false;
  showSettle = false;
  showMyQr = false;
  toastMessage = signal<string | null>(null);
  loading = signal(true);

  description = '';
  amount: number | null = null;
  selectedMembers = signal<Set<string>>(new Set());
  includeMeInSplit = true;

  settleTarget: DebtPair | null = null;
  settleAmount: number | null = null;
  settleNote = '';
  settleUpiId = '';
  error = signal<string | null>(null);

  myUpiId = '';
  me = this.auth.user;

  ngOnInit(): void {
    this.groupId = this.route.snapshot.paramMap.get('groupId') || localStorage.getItem('rl_group_id') || '1';
    
    // Load my real UPI ID from Profile
    this.api.get<any>('profile').subscribe({
      next: (p) => {
        if (p?.upiId) {
          this.myUpiId = p.upiId;
        }
      },
      error: () => {}
    });

    this.load();
    this.loadExpenses();

    this.api.get<any>(`groups/${this.groupId}`).subscribe({
      next: (g) => {
        if (g?.groupName) this.groupName.set(g.groupName);
        const myId = this.auth.user()?.id;
        const members: GroupMemberVm[] = (g?.members ?? [])
          .filter((m: any) => Number(m.userId) !== myId)
          .map((m: any) => ({
            id: String(m.userId),
            name: m.fullName || `Flatmate #${m.userId}`,
            isAdmin: m.role === 'Admin'
          }));
        this.groupMembers.set(members);
      },
      error: () => {}
    });
  }

  load(): void {
    this.loading.set(true);
    this.api.get<MyBalance>(`groups/${this.groupId}/iou/my-balance`).subscribe({
      next: (b) => {
        this.loading.set(false);
        if (b) {
          this.balance.set(b);
        }
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  loadExpenses(): void {
    this.api.get<any[]>(`groups/${this.groupId}/iou/expenses`).subscribe({
      next: (data) => this.expenses.set(data || []),
      error: () => {}
    });
  }

  totalOwedToMe(): number {
    return (this.balance()?.owedToMe ?? []).reduce((acc, d) => acc + (d.amount || 0), 0);
  }

  totalIOwe(): number {
    return (this.balance()?.iOwe ?? []).reduce((acc, d) => acc + (d.amount || 0), 0);
  }

  netBalance(): number {
    const bal = this.balance();
    if (bal && typeof bal.netBalance === 'number') {
      return bal.netBalance;
    }
    return this.totalOwedToMe() - this.totalIOwe();
  }

  toggleMember(id: string): void {
    const s = new Set(this.selectedMembers());
    s.has(id) ? s.delete(id) : s.add(id);
    this.selectedMembers.set(s);
  }

  selectAllMembers(): void {
    const s = new Set<string>();
    for (const m of this.groupMembers()) {
      s.add(m.id);
    }
    this.selectedMembers.set(s);
  }

  clearSelectedMembers(): void {
    this.selectedMembers.set(new Set());
  }

  addExpense(): void {
    if (!this.description.trim() || !this.amount || this.amount <= 0) return;

    const participantIds = [...this.selectedMembers()];
    if (this.includeMeInSplit && this.auth.user()?.id) {
      const myIdStr = String(this.auth.user()!.id);
      if (!participantIds.includes(myIdStr)) {
        participantIds.push(myIdStr);
      }
    }

    if (participantIds.length === 0) {
      this.popup.warning('Please select at least one roommate to split with');
      return;
    }

    const participants = participantIds.map(id => ({
      userId: parseInt(id, 10),
      shareAmount: null
    }));

    const body = {
      description: this.description.trim(),
      amount: this.amount,
      sharedWith: participantIds,
      participants: participants,
      expenseDate: new Date().toISOString().slice(0, 10)
    };

    this.api.post(`groups/${this.groupId}/iou/expenses`, body).subscribe({
      next: () => {
        this.showAdd = false;
        this.showToast('✅ Shared expense added & split!');
        this.load();
        this.loadExpenses();
        this.resetForm();
      },
      error: (e) => this.popup.error(e.error?.message ?? 'Failed to add expense')
    });
  }

  openSettle(d: DebtPair): void {
    this.settleTarget = d;
    this.settleAmount = d.amount;
    this.settleUpiId = d.upiId || '';
    this.settleNote = `Settling shared expense of ₹${d.amount}`;
    this.showSettle = true;
    this.error.set(null);
    const uri = this.getUpiUri(this.settleUpiId, d.toUserName, d.amount);
    setTimeout(() => this.drawQrCode(this.iouQrCanvasRef, uri), 100);
  }

  onSettleUpiChange(val: string): void {
    this.settleUpiId = val;
    if (this.settleTarget && this.settleAmount) {
      const uri = this.getUpiUri(val, this.settleTarget.toUserName, this.settleAmount);
      this.drawQrCode(this.iouQrCanvasRef, uri);
    }
  }

  getUpiUri(upiId: string, payeeName: string, amount: number): string {
    const vpa = upiId.trim();
    if (!vpa) return 'upi://pay';
    const name = encodeURIComponent(payeeName.trim() || 'Flatmate');
    const amt = amount ? amount.toFixed(2) : '0.00';
    const note = encodeURIComponent('RoomLedger Settle Up');
    return `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${name}&am=${amt}&cu=INR&tn=${note}`;
  }

  payViaUpiApp(): void {
    if (!this.settleUpiId || !this.settleTarget || !this.settleAmount) {
      this.showToast('⚠️ Recipient has no UPI ID. Enter their UPI ID to launch app.');
      return;
    }
    const uri = this.getUpiUri(this.settleUpiId, this.settleTarget.toUserName, this.settleAmount);
    window.location.href = uri;
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
        this.loadExpenses();
      },
      error: (e) => {
        this.showToast(`❌ ${e.error?.message || 'Failed to record settlement'}`);
      }
    });
  }

  async markReceived(d: DebtPair): Promise<void> {
    const confirmed = await this.popup.confirm({
      title: 'Confirm Payment Received',
      message: `Mark payment of ₹${d.amount} received from ${d.fromUserName}?`,
      confirmText: 'Mark Received',
      cancelText: 'Cancel',
      type: 'primary'
    });
    if (!confirmed) return;

    this.api.post(`groups/${this.groupId}/iou/settle-up`, {
      fromUserId: d.fromUserId,
      payerId: d.fromUserId,
      payeeId: this.auth.user()?.id,
      amount: d.amount,
      note: `Received settlement from ${d.fromUserName}`
    }).subscribe({
      next: () => {
        this.showToast(`✅ Marked ₹${d.amount} received from ${d.fromUserName}!`);
        this.load();
        this.loadExpenses();
      },
      error: (e) => {
        this.showToast(`❌ ${e.error?.message || 'Failed to record settlement'}`);
      }
    });
  }

  openMyQrModal(): void {
    this.showMyQr = true;
    const myName = this.auth.user()?.fullName || this.auth.user()?.name || 'Flatmate';
    const uri = this.myUpiId 
      ? `upi://pay?pa=${encodeURIComponent(this.myUpiId)}&pn=${encodeURIComponent(myName)}&cu=INR` 
      : 'upi://pay';
    setTimeout(() => this.drawQrCode(this.myQrCanvasRef, uri), 100);
  }

  sendReminder(d: DebtPair): void {
    const debtorId = d.fromUserId;
    if (!debtorId) return;
    this.api.post<any>(`groups/${this.groupId}/iou/debts/${debtorId}/remind`, {}).subscribe({
      next: (res) => {
        this.showToast(res?.message || `🔔 Reminder sent to ${d.fromUserName}!`);
      },
      error: (e) => {
        this.showToast(e.error?.message || `🔔 Reminder sent to ${d.fromUserName}!`);
      }
    });
  }

  async voidExpense(exp: any): Promise<void> {
    const confirmed = await this.popup.confirm({
      title: 'Void Shared Expense',
      message: `Void "${exp.description}"? This will reverse the debt splits for all participants.`,
      confirmText: 'Void Expense',
      cancelText: 'Keep Expense',
      type: 'danger'
    });
    if (!confirmed) return;

    this.api.post(`groups/${this.groupId}/iou/expenses/${exp.id}/void`, { reason: 'Voided by user' }).subscribe({
      next: () => {
        this.showToast('🗑️ Shared expense voided');
        this.load();
        this.loadExpenses();
      },
      error: (e) => this.showToast(`❌ ${e.error?.message || 'Failed to void expense'}`)
    });
  }

  drawQrCode(canvasRef?: ElementRef<HTMLCanvasElement>, text: string = ''): void {
    const cv = canvasRef?.nativeElement;
    if (!cv) return;

    if (!text || text === 'upi://pay') {
      const ctx = cv.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, cv.width, cv.height);
      return;
    }

    QRCode.toCanvas(cv, text, {
      width: 150,
      margin: 1,
      color: {
        dark: '#111827',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    }, (err: any) => {
      if (err) {
        console.error('Failed to generate IOU QR code:', err);
      }
    });
  }

  resetForm(): void {
    this.description = '';
    this.amount = null;
    this.selectedMembers.set(new Set());
    this.includeMeInSplit = true;
    this.error.set(null);
  }

  abs(n: number): number {
    return Math.abs(n);
  }

  showToast(msg: string): void {
    if (msg.startsWith('❌')) {
      this.popup.error(msg.replace(/^❌\s*/, ''));
    } else if (msg.startsWith('🔔') || msg.startsWith('ℹ️')) {
      this.popup.info(msg);
    } else {
      this.popup.success(msg);
    }
  }

  goToDashboard(): void {
    this.router.navigate(['/g', this.groupId, 'dashboard']);
  }
}
