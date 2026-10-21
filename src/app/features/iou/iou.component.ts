import { Component, OnInit, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { PopupService } from '../../core/services/popup.service';
import { MyBalance, DebtPair } from '../shared/models';
import { PageLoaderComponent } from '../shared/components/page-loader/page-loader.component';
import { UpiPaymentModalComponent } from '../shared/components/upi-payment-modal/upi-payment-modal.component';
import * as QRCode from 'qrcode';

interface GroupMemberVm {
  id: string;
  name: string;
  isAdmin: boolean;
}

@Component({
  selector: 'app-iou',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe, RouterLink, PageLoaderComponent, UpiPaymentModalComponent],
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

  // ── Instant UPI Payment Gateway (YouPI-PG) ──
  showUpiModal = signal<boolean>(false);
  upiAmount = signal<number>(0);
  upiPayeeId = signal<number | null>(null);
  upiPayeeName = signal<string>('Flatmate');
  upiPayeeVpa = signal<string>('');

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

  splitMode = signal<'equal' | 'custom' | 'itemized'>('equal');
  customShares: { [memberId: string]: number | null } = {};
  receiptItems = signal<Array<{ itemName: string; amount: number | null; eaterUserIds: Set<number> }>>([
    { itemName: 'Item 1', amount: null, eaterUserIds: new Set<number>() }
  ]);

  setSplitMode(mode: 'equal' | 'custom' | 'itemized'): void {
    this.splitMode.set(mode);
    if (mode === 'custom') {
      this.initCustomShares();
    } else if (mode === 'itemized' && this.receiptItems().length === 0) {
      this.addItemizedRow();
    }
  }

  getActiveSplitMemberIds(): string[] {
    const participantIds = [...this.selectedMembers()];
    if (this.includeMeInSplit && this.auth.user()?.id) {
      const myIdStr = String(this.auth.user()!.id);
      if (!participantIds.includes(myIdStr)) {
        participantIds.push(myIdStr);
      }
    }
    return participantIds;
  }

  initCustomShares(): void {
    const list = this.getActiveSplitMemberIds();
    if (!this.amount || this.amount <= 0 || list.length === 0) return;
    const equalShare = Math.round((this.amount / list.length) * 100) / 100;
    for (const id of list) {
      if (this.customShares[id] == null) {
        this.customShares[id] = equalShare;
      }
    }
  }

  getCustomSum(): number {
    const list = this.getActiveSplitMemberIds();
    return list.reduce((acc, id) => acc + (Number(this.customShares[id]) || 0), 0);
  }

  getCustomRemaining(): number {
    return (this.amount || 0) - this.getCustomSum();
  }

  addItemizedRow(): void {
    const allMemberUserIds = new Set<number>();
    for (const m of this.groupMembers()) {
      allMemberUserIds.add(Number(m.id));
    }
    if (this.auth.user()?.id) {
      allMemberUserIds.add(this.auth.user()!.id);
    }

    this.receiptItems.update(items => [
      ...items,
      {
        itemName: `Item ${items.length + 1}`,
        amount: null,
        eaterUserIds: new Set<number>(allMemberUserIds)
      }
    ]);
  }

  removeItemizedRow(index: number): void {
    this.receiptItems.update(items => items.filter((_, i) => i !== index));
  }

  toggleItemEater(index: number, userId: number): void {
    this.receiptItems.update(items => {
      const next = [...items];
      const item = { ...next[index] };
      const eaters = new Set(item.eaterUserIds);
      if (eaters.has(userId)) {
        eaters.delete(userId);
      } else {
        eaters.add(userId);
      }
      item.eaterUserIds = eaters;
      next[index] = item;
      return next;
    });
  }

  isEaterSelected(index: number, userId: number): boolean {
    const item = this.receiptItems()[index];
    return item ? item.eaterUserIds.has(userId) : false;
  }

  getItemizedSum(): number {
    return this.receiptItems().reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
  }

  getItemizedRemaining(): number {
    return (this.amount || 0) - this.getItemizedSum();
  }

  myUserIdStr(): string {
    return this.auth.user()?.id ? String(this.auth.user()!.id) : '0';
  }

  getAllGroupMembersWithMe(): GroupMemberVm[] {
    const list = [...this.groupMembers()];
    const u = this.auth.user();
    if (u) {
      list.unshift({
        id: String(u.id),
        name: `${u.fullName || u.name || 'You'} (Me)`,
        isAdmin: false
      });
    }
    return list;
  }

  addExpense(): void {
    if (!this.description.trim() || !this.amount || this.amount <= 0) {
      this.popup.warning('Please enter a description and amount');
      return;
    }

    const mode = this.splitMode();

    if (mode === 'equal') {
      const participantIds = this.getActiveSplitMemberIds();
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
          this.showToast('✅ Shared expense added (Equal Split)!');
          this.load();
          this.loadExpenses();
          this.resetForm();
        },
        error: (e) => this.popup.error(e.error?.message ?? 'Failed to add expense')
      });
    } else if (mode === 'custom') {
      const participantIds = this.getActiveSplitMemberIds();
      if (participantIds.length === 0) {
        this.popup.warning('Please select participants for custom split');
        return;
      }
      const remaining = Math.abs(this.getCustomRemaining());
      if (remaining > 0.05) {
        this.popup.warning(`Custom shares sum (₹${this.getCustomSum().toFixed(2)}) must equal total ₹${this.amount}. Difference: ₹${this.getCustomRemaining().toFixed(2)}`);
        return;
      }
      const participants = participantIds.map(id => ({
        userId: parseInt(id, 10),
        shareAmount: Number(this.customShares[id]) || 0
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
          this.showToast('✅ Shared expense added (Custom Split)!');
          this.load();
          this.loadExpenses();
          this.resetForm();
        },
        error: (e) => this.popup.error(e.error?.message ?? 'Failed to add expense')
      });
    } else if (mode === 'itemized') {
      const items = this.receiptItems();
      if (items.length === 0) {
        this.popup.warning('Add at least one item');
        return;
      }
      for (const it of items) {
        if (!it.itemName?.trim()) {
          this.popup.warning('All receipt items must have a name');
          return;
        }
        if (!it.amount || it.amount <= 0) {
          this.popup.warning(`Item "${it.itemName}" has an invalid amount`);
          return;
        }
        if (it.eaterUserIds.size === 0) {
          this.popup.warning(`Item "${it.itemName}" must have at least one flatmate selected`);
          return;
        }
      }
      const diff = Math.abs(this.getItemizedRemaining());
      if (diff > 0.05) {
        this.popup.warning(`Itemized items total (₹${this.getItemizedSum().toFixed(2)}) must match bill total ₹${this.amount}`);
        return;
      }

      const payload = {
        description: this.description.trim(),
        amount: this.amount,
        expenseDate: new Date().toISOString().slice(0, 10),
        items: items.map(it => ({
          itemName: it.itemName.trim(),
          amount: Number(it.amount),
          eaterUserIds: Array.from(it.eaterUserIds)
        }))
      };

      this.api.post(`groups/${this.groupId}/iou/expenses/itemized`, payload).subscribe({
        next: () => {
          this.showAdd = false;
          this.showToast('✅ Itemized expense added & split!');
          this.load();
          this.loadExpenses();
          this.resetForm();
        },
        error: (e) => this.popup.error(e.error?.message ?? 'Failed to add itemized expense')
      });
    }
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
    return `upi://pay?pa=${vpa}&pn=${name}&am=${amt}&cu=INR&tn=${note}`;
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

  // ═══════════════════════════════════════════
  // INSTANT UPI PAYMENT (YOUPI GATEWAY)
  // ═══════════════════════════════════════════
  openInstantUpi(d: DebtPair): void {
    this.settleTarget = d;
    this.upiPayeeId.set(d.toUserId);
    this.upiPayeeName.set(d.toUserName || 'Flatmate');
    this.upiPayeeVpa.set(d.upiId?.trim() || '');
    this.upiAmount.set(d.amount);
    this.showSettle = false;
    this.showUpiModal.set(true);
  }

  closeUpiModal(): void {
    this.showUpiModal.set(false);
  }

  onUpiIouSuccess(event: { orderId: string; utr?: string; amount: number }): void {
    this.showUpiModal.set(false);
    this.showToast(`🎉 Settled ₹${event.amount} via Instant UPI! Debt cleared.`);
    this.load();
    this.loadExpenses();
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
      ? `upi://pay?pa=${this.myUpiId.trim()}&pn=${encodeURIComponent(myName)}&cu=INR` 
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
    this.splitMode.set('equal');
    this.customShares = {};
    this.receiptItems.set([
      { itemName: 'Item 1', amount: null, eaterUserIds: new Set<number>() }
    ]);
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
