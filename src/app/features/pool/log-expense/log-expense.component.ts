import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { PopupService } from '../../../core/services/popup.service';
import { MemberStatus } from '../../shared/models';
import { environment } from '../../../../environments/environment';
import { compressImageFile } from '../../../core/utils/image-utils';

export interface CategoryOption {
  name: string;
  icon: string;
  color: string;
  bg: string;
}

export interface ReceiptRow {
  id: number;
  name: string;
  qty: number | null;
  rate: number | null;
  price: number | null;
}

@Component({
  selector: 'app-log-expense',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './log-expense.component.html',
  styleUrls: ['./log-expense.component.scss']
})
export class LogExpenseComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private popup = inject(PopupService);

  groupId = '1';
  memberStatuses = signal<MemberStatus[]>([]);
  recordInBills = signal<boolean>(true);

  // Who Paid?
  expensePayer = signal<'pool' | 'me'>('pool');
  paidByMemberId = signal<number | null>(null);

  // Expense Details
  expenseName = '';
  expenseDate = new Date().toISOString().slice(0, 10);
  expenseCategory = '';
  customCategory = '';
  categoryDropdownOpen = signal<boolean>(false);

  categoryOptions: CategoryOption[] = [
    { name: 'Groceries', icon: 'fa-solid fa-basket-shopping', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
    { name: 'Dairy & Essentials', icon: 'fa-solid fa-bottle-water', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)' },
    { name: 'Utilities & Bills', icon: 'fa-solid fa-bolt', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
    { name: 'Cleaning & Household', icon: 'fa-solid fa-spray-can-sparkles', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
    { name: 'Food & Snacks', icon: 'fa-solid fa-utensils', color: '#f97316', bg: 'rgba(249, 115, 22, 0.12)' },
    { name: 'Maintenance & Repairs', icon: 'fa-solid fa-wrench', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)' },
    { name: 'Travel & Transport', icon: 'fa-solid fa-taxi', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
    { name: 'Other', icon: 'fa-solid fa-box-open', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' }
  ];

  categories = [
    'Groceries',
    'Dairy & Essentials',
    'Utilities & Bills',
    'Cleaning & Household',
    'Food & Snacks',
    'Maintenance & Repairs',
    'Travel & Transport',
    'Other'
  ];

  toggleCategoryDropdown(): void {
    this.categoryDropdownOpen.update(v => !v);
  }

  selectCategory(name: string): void {
    this.expenseCategory = name;
    this.categoryDropdownOpen.set(false);
    if (name !== 'Other' && name !== '📦 Other') {
      this.customCategory = '';
    }
  }

  getSelectedCategoryOption(): CategoryOption | undefined {
    if (!this.expenseCategory) return undefined;
    const clean = this.getCleanCategoryName(this.expenseCategory).toLowerCase();
    return this.categoryOptions.find(o => o.name.toLowerCase() === clean || clean.includes(o.name.toLowerCase())) ||
      { name: this.expenseCategory, icon: 'fa-solid fa-box-open', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' };
  }

  expenseTotal: number | null = null;
  expenseRows: ReceiptRow[] = [];
  rowCounter = 1;
  savingExpense = false;

  // Receipt image attachment
  receiptPreview = signal<string | null>(null);
  receiptUrl: string | null = null;
  uploadingReceipt = signal(false);
  selectedReceiptImage = signal<string | null>(null);

  // Dynamic flat members for "SHARED AMONG FLAT"
  splitWith = signal<{ id: string; name: string; initials: string; selected: boolean }[]>([]);

  // Edit Mode state
  isEditMode = signal<boolean>(false);
  editExpenseId = signal<number | null>(null);
  loadingEditExpense = signal<boolean>(false);

  toastMessage = signal<string | null>(null);

  ngOnInit(): void {
    // Check parent or current route param for groupId
    this.groupId = this.route.snapshot.paramMap.get('groupId') ||
                   this.route.parent?.snapshot.paramMap.get('groupId') ||
                   localStorage.getItem('rl_group_id') || '1';

    this.initExpenseRows();
    this.loadGroupMembers();

    // Check for edit mode via query params (?editExpenseId=123)
    this.route.queryParamMap.subscribe(params => {
      const editId = params.get('editExpenseId');
      if (editId) {
        this.isEditMode.set(true);
        this.editExpenseId.set(+editId);
        this.loadExpenseForEdit(+editId);
      }
    });
  }

  loadExpenseForEdit(expenseId: number): void {
    this.loadingEditExpense.set(true);
    this.api.get<any>(`groups/${this.groupId}/pool/expenses/${expenseId}`).subscribe({
      next: (res) => {
        this.loadingEditExpense.set(false);
        if (!res) return;

        if (res.isLatest === false) {
          this.popup.warning('⚠️ Only the last recorded transaction can be edited.');
          setTimeout(() => {
            this.router.navigate(['/g', this.groupId, 'history']);
          }, 1200);
          return;
        }

        this.expenseName = res.description || '';
        this.expenseDate = res.expenseDate || new Date().toISOString().slice(0, 10);
        this.expenseTotal = res.totalAmount != null ? res.totalAmount : null;

        // Category selection
        if (res.category) {
          const clean = this.getCleanCategoryName(res.category).toLowerCase();
          const match = this.categoryOptions.find(o => o.name.toLowerCase() === clean);
          if (match) {
            this.expenseCategory = match.name;
            this.customCategory = '';
          } else {
            this.expenseCategory = 'Other';
            this.customCategory = res.category;
          }
        }

        // Payer
        if (res.payerType === 'me' || res.paidByUserId) {
          this.expensePayer.set('me');
          if (res.paidByUserId) {
            this.paidByMemberId.set(res.paidByUserId);
          }
        } else {
          this.expensePayer.set('pool');
        }

        // Receipt
        if (res.receiptUrl) {
          this.receiptUrl = res.receiptUrl;
          this.receiptPreview.set(this.getFullUrl(res.receiptUrl));
        } else {
          this.receiptUrl = null;
          this.receiptPreview.set(null);
        }

        // Line items
        if (res.items && res.items.length > 0) {
          this.expenseRows = res.items.map((it: any, idx: number) => ({
            id: idx + 1,
            name: it.name || it.itemName || '',
            qty: it.qty || it.quantity || 1,
            rate: null,
            price: it.price != null ? it.price : (it.amount != null ? it.amount : null)
          }));
          this.rowCounter = this.expenseRows.length;
        } else {
          this.expenseRows = [{
            id: 1,
            name: res.description || '',
            qty: 1,
            rate: null,
            price: res.totalAmount != null ? res.totalAmount : null
          }];
          this.rowCounter = 1;
        }
      },
      error: (err) => {
        this.loadingEditExpense.set(false);
        this.popup.error(err.error?.message || 'Failed to load expense for editing');
      }
    });
  }

  initExpenseRows(): void {
    this.rowCounter = 1;
    this.expenseRows = [{ id: 1, name: '', qty: 1, rate: null, price: null }];
  }

  get me() {
    return this.auth.user();
  }

  loadGroupMembers(): void {
    this.api.get<{ memberStatuses: MemberStatus[] }>(`groups/${this.groupId}/pool/balance`).subscribe({
      next: (b) => {
        if (b.memberStatuses && b.memberStatuses.length > 0) {
          this.memberStatuses.set(b.memberStatuses);
          this.splitWith.set(b.memberStatuses.map(m => ({
            id: String(m.userId),
            name: m.userName,
            initials: this.getInitials(m.userName),
            selected: true
          })));

          if (this.me?.id && !this.paidByMemberId()) {
            this.paidByMemberId.set(this.me.id);
          }
        }
      },
      error: () => {
        // Fallback: try loading from groups endpoint
        this.api.get<{ members: any[] }>(`groups/${this.groupId}`).subscribe({
          next: (g) => {
            if (g.members) {
              this.splitWith.set(g.members.map(m => ({
                id: String(m.userId || m.id),
                name: m.fullName || m.name,
                initials: this.getInitials(m.fullName || m.name),
                selected: true
              })));
            }
          }
        });
      }
    });
  }

  getInitials(name?: string): string {
    if (!name || !name.trim()) return 'DK';
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  async onReceiptPicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const rawFile = input.files?.[0];
    if (!rawFile) return;

    if (rawFile.size > 15 * 1024 * 1024) {
      this.showToast('⚠️ Image must be under 15 MB');
      return;
    }

    this.uploadingReceipt.set(true);

    try {
      // Fast client-side resize & compression (converts 5MB-10MB phone photo to ~150KB in <50ms)
      const compressedFile = await compressImageFile(rawFile, 1600, 0.82);

      const previewUrl = URL.createObjectURL(compressedFile);
      this.receiptPreview.set(previewUrl);

      const fd = new FormData();
      fd.append('file', compressedFile);

      this.api.postForm<{ receiptUrl: string }>(`groups/${this.groupId}/pool/receipt`, fd).subscribe({
        next: (res) => {
          this.receiptUrl = res.receiptUrl;
          this.uploadingReceipt.set(false);
          this.showToast('📸 Bill receipt attached!');
        },
        error: (err: any) => {
          this.uploadingReceipt.set(false);
          this.showToast(err.error?.message ?? '⚠️ Receipt upload failed');
        }
      });
    } catch {
      this.uploadingReceipt.set(false);
      this.showToast('⚠️ Could not process image file');
    }
  }

  removeReceipt(): void {
    this.receiptPreview.set(null);
    this.receiptUrl = null;
  }

  viewReceipt(url?: string | null): void {
    if (!url) return;
    this.selectedReceiptImage.set(this.getFullUrl(url));
  }

  closeReceiptModal(): void {
    this.selectedReceiptImage.set(null);
  }

  getFullUrl(path?: string | null): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  get canAddSubItem(): boolean {
    if (this.expenseRows.length === 0) return true;
    const last = this.expenseRows[this.expenseRows.length - 1];
    return !!(last.name && last.name.trim() && last.price !== null && last.price !== undefined && last.price > 0);
  }

  addRow(): void {
    if (!this.canAddSubItem) {
      this.showToast('⚠️ Please enter current item name and amount before adding another sub-item');
      return;
    }
    this.rowCounter++;
    this.expenseRows.push({ id: this.rowCounter, name: '', qty: 1, rate: null, price: null });
  }

  removeRow(id: number): void {
    this.expenseRows = this.expenseRows.filter(r => r.id !== id);
    if (!this.expenseTotal || this.expenseTotal <= 0) {
      if (this.expenseRows.length > 0) {
        this.expenseTotal = Number(this.itemsSum.toFixed(2));
      }
    }
  }

  onRowQtyChange(row: ReceiptRow): void {
    if (row.qty !== null && row.qty !== undefined && row.qty < 1) {
      row.qty = 1;
    }
  }

  onRowPriceChange(row?: ReceiptRow): void {
    if (!this.expenseTotal || this.expenseTotal <= 0) {
      this.expenseTotal = Number(this.itemsSum.toFixed(2));
    }
  }

  onTotalSpendChange(): void {
    if (this.expenseRows.length === 1 && (!this.expenseRows[0].price || this.expenseRows[0].price <= 0)) {
      this.expenseRows[0].price = this.expenseTotal;
    }
  }

  syncTotalFromItems(): void {
    this.expenseTotal = Number(this.itemsSum.toFixed(2));
  }

  get itemsSum(): number {
    return Number(this.expenseRows.reduce((acc, r) => acc + (r.price || 0), 0).toFixed(2));
  }

  get hasReceiptMismatch(): boolean {
    const total = this.expenseTotal || 0;
    const sum = this.itemsSum;
    if (total <= 0 && sum <= 0) return false;
    return Math.abs(total - sum) >= 0.01;
  }

  get isReceiptBalanced(): boolean {
    const total = this.expenseTotal || 0;
    const sum = this.itemsSum;
    if (total <= 0 || sum <= 0) return false;
    return Math.abs(total - sum) < 0.01;
  }

  get receiptMismatchDiff(): number {
    const total = this.expenseTotal || 0;
    const sum = this.itemsSum;
    return Number(Math.abs(total - sum).toFixed(2));
  }

  toggleSplitParticipant(id: string): void {
    this.splitWith.update(list =>
      list.map(p => p.id === id ? { ...p, selected: !p.selected } : p)
    );
  }

  selectAllSplit(select: boolean): void {
    this.splitWith.update(list => list.map(p => ({ ...p, selected: select })));
  }

  getMemberBgColor(id: string | number): string {
    const colors = [
      'linear-gradient(135deg, #00b074, #059669)',
      'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      'linear-gradient(135deg, #f59e0b, #d97706)',
      'linear-gradient(135deg, #ec4899, #be185d)',
      'linear-gradient(135deg, #8b5cf6, #6d28d9)',
      'linear-gradient(135deg, #14b8a6, #0f766e)'
    ];
    const num = typeof id === 'number' ? id : (parseInt(id, 10) || (id ? id.charCodeAt(0) : 0));
    return colors[Math.abs(num) % colors.length];
  }

  getPayerDisplayName(): string {
    if (this.expensePayer() === 'pool') {
      return 'Central Room Pool';
    }
    const memberId = this.paidByMemberId();
    if (!memberId || memberId === this.me?.id) {
      return this.me?.fullName || 'You';
    }
    const member = this.memberStatuses().find(m => m.userId === memberId);
    return member?.userName || 'Roommate';
  }

  getCleanCategoryName(cat: string): string {
    if (!cat) return 'Groceries';
    const cleaned = cat.replace(/^[\p{Emoji}\p{Extended_Pictographic}\s]+/u, '').trim();
    return cleaned || cat.trim();
  }

  isUtilityBill(): boolean {
    const cat = (this.expenseCategory || '').toLowerCase();
    return cat.includes('utilities') || cat.includes('bill');
  }

  submitExpense(): void {
    const desc = this.expenseName.trim();
    if (!desc) {
      this.popup.warning('Please enter an expense name');
      return;
    }

    if (!this.expenseCategory || !this.expenseCategory.trim()) {
      this.popup.warning('Please select an expense category');
      return;
    }

    if (!this.expenseTotal || this.expenseTotal <= 0) {
      this.popup.warning('Total spend must be greater than zero');
      return;
    }

    const isUtility = this.isUtilityBill();
    let items: { itemName: string; quantity: number; amount: number; categoryId: number | null }[] = [];

    if (isUtility) {
      // Case 3: Utility & recurring bill flow - single entry bypasses receipt line items
      items = [{
        itemName: desc,
        quantity: 1,
        amount: this.expenseTotal,
        categoryId: null
      }];
    } else {
      if (this.expenseRows.length === 0) {
        this.popup.warning('Please add at least one itemized receipt item');
        return;
      }

      const validItems = this.expenseRows
        .filter(r => r.name.trim() && r.price !== null && r.price > 0);

      if (validItems.length === 0) {
        this.popup.warning('Please enter item name and price for receipt items');
        return;
      }

      if (!this.isReceiptBalanced) {
        this.popup.warning('Please balance receipt items with total spend first');
        return;
      }

      items = validItems.map(r => ({
        itemName: r.name.trim(),
        quantity: r.qty && r.qty > 0 ? r.qty : 1,
        amount: r.price!,
        categoryId: null
      }));
    }

    const payerType = this.expensePayer();
    const paidByUserId = payerType === 'me' ? (this.paidByMemberId() || this.me?.id || null) : null;
    const selectedMemberIds = this.splitWith().filter(m => m.selected).map(m => m.id);

    const isOther = this.expenseCategory === 'Other' || this.expenseCategory === '📦 Other';
    const selectedCat = isOther && this.customCategory.trim()
      ? this.customCategory.trim()
      : this.expenseCategory;
    const finalCategory = this.getCleanCategoryName(selectedCat);

    if (this.isEditMode() && this.editExpenseId()) {
      const editPayload = {
        description: desc,
        amount: this.expenseTotal,
        expenseDate: this.expenseDate,
        category: finalCategory,
        receiptUrl: this.receiptUrl,
        payerType: payerType,
        paidByUserId: paidByUserId,
        reason: 'Admin updated expense details',
        items: items.map(i => ({
          categoryId: i.categoryId,
          itemName: i.itemName,
          amount: i.amount,
          quantity: i.quantity
        }))
      };

      this.savingExpense = true;
      this.api.put<{ message: string }>(`groups/${this.groupId}/pool/expenses/${this.editExpenseId()}`, editPayload).subscribe({
        next: (res) => {
          this.savingExpense = false;
          this.popup.success(res.message || 'Expense updated successfully!');
          setTimeout(() => {
            this.router.navigate(['/g', this.groupId, 'history']);
          }, 600);
        },
        error: (e) => {
          this.savingExpense = false;
          this.popup.error(e.error?.message || 'Failed to update expense');
        }
      });
      return;
    }

    const payload = {
      description: desc,
      expenseDate: this.expenseDate,
      category: finalCategory,
      receiptUrl: this.receiptUrl,
      payerType: payerType,
      paidByUserId: paidByUserId,
      sharedMemberIds: selectedMemberIds,
      recordInBills: isUtility ? this.recordInBills() : false,
      items: items
    };

    this.savingExpense = true;
    this.api.post<{ message: string }>(`groups/${this.groupId}/pool/expenses`, payload).subscribe({
      next: (res) => {
        this.savingExpense = false;
        this.popup.success(res.message || 'Expense logged to Daily Pool!');
        setTimeout(() => {
          this.router.navigate(['/g', this.groupId, 'pool']);
        }, 800);
      },
      error: (e) => {
        this.savingExpense = false;
        this.popup.error(e.error?.message || 'Failed to log expense');
      }
    });
  }

  backToPool(): void {
    if (this.isEditMode()) {
      this.router.navigate(['/g', this.groupId, 'history']);
    } else {
      this.router.navigate(['/g', this.groupId, 'pool']);
    }
  }

  showToast(msg: string): void {
    if (msg.startsWith('❌')) {
      this.popup.error(msg.replace(/^❌\s*/, ''));
    } else if (msg.startsWith('⚠️')) {
      this.popup.warning(msg.replace(/^⚠️\s*/, ''));
    } else {
      this.popup.success(msg);
    }
  }
}
