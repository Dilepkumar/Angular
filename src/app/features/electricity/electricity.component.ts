import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ElectricityService, CreateElectricityAccountPayload } from '../../core/services/electricity.service';
import { ApiService } from '../../core/services/api.service';
import { PopupService } from '../../core/services/popup.service';
import {
  ElectricityAccount,
  ElectricityBill,
  ElectricityBiller,
  ElectricityBillerDetail,
  ElectricityBillSplits,
  ElectricityMonitoringStatus
} from '../shared/models';

@Component({
  selector: 'app-electricity',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './electricity.component.html',
  styleUrls: ['./electricity.component.scss']
})
export class ElectricityComponent implements OnInit {
  private electricityService = inject(ElectricityService);
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private popup = inject(PopupService);

  groupId = signal<string>('1');
  groupName = signal<string>('Apartment');

  accounts = signal<ElectricityAccount[]>([]);
  selectedAccount = signal<ElectricityAccount | null>(null);
  billers = signal<ElectricityBiller[]>([]);
  splits = signal<ElectricityBillSplits | null>(null);
  monitoringStatus = signal<ElectricityMonitoringStatus | null>(null);

  loading = signal<boolean>(false);
  checking = signal<boolean>(false);
  loadingSplits = signal<boolean>(false);
  loadingBillers = signal<boolean>(false);
  loadingBillerDetail = signal<boolean>(false);

  // Add Account Modal State
  showAddModal = signal<boolean>(false);
  showLogsModal = signal<boolean>(false);
  billerSearch = '';
  selectedBillerId = '';
  billerDropdownOpen = signal<boolean>(false);
  selectedBillerDetail = signal<ElectricityBillerDetail | null>(null);
  dynamicParamValues: Record<string, string> = {};
  expectedBillDayOfMonth: number | null = null;
  submitting = signal<boolean>(false);

  // Filtered Billers with flexible spelling & acronym support (e.g. "telengana" / "tgsp")
  filteredBillers = computed(() => {
    const raw = this.billerSearch.toLowerCase().trim();
    if (!raw) return this.billers();

    const normalized = raw.replace(/telengana/g, 'telangana').replace(/teleng/g, 'telang');

    return this.billers().filter(b => {
      const name = b.name.toLowerCase();
      const state = (b.state || '').toLowerCase();
      const id = b.id.toLowerCase();

      return (
        name.includes(raw) ||
        name.includes(normalized) ||
        state.includes(raw) ||
        state.includes(normalized) ||
        id.includes(raw) ||
        id.includes(normalized)
      );
    });
  });

  // Limit check indicator
  canCheckCurrent = computed(() => {
    const acc = this.selectedAccount();
    if (!acc) return false;
    return acc.remainingManualChecksToday > 0;
  });

  // Per Person equal share computed helper
  perPersonShare = computed(() => {
    const s = this.splits();
    if (s && s.splits && s.splits.length > 0) {
      return s.splits[0].shareAmount;
    }
    const bill = this.selectedAccount()?.latestBill;
    if (bill && bill.totalAmount > 0) {
      return Math.round((bill.totalAmount / 5) * 100) / 100;
    }
    return 0;
  });

  // Number of active roommates participating in equal split
  splitMemberCount = computed(() => {
    const s = this.splits();
    return s?.splits?.length || 5;
  });

  ngOnInit(): void {
    const gId = this.route.snapshot.paramMap.get('groupId') || localStorage.getItem('rl_group_id') || '1';
    this.groupId.set(gId);

    this.api.get<any>(`groups/${gId}`).subscribe({
      next: (g) => {
        if (g?.groupName) this.groupName.set(g.groupName);
      },
      error: () => {}
    });

    this.loadAccounts();
  }

  loadAccounts(): void {
    this.loading.set(true);
    const gIdNum = parseInt(this.groupId(), 10) || 1;

    this.electricityService.getAccounts(gIdNum).subscribe({
      next: (data) => {
        this.loading.set(false);
        this.accounts.set(data || []);
        if (data && data.length > 0) {
          // Keep current selection or default to first
          const currentId = this.selectedAccount()?.id;
          const matched = data.find(a => a.id === currentId);
          this.selectAccount(matched || data[0]);
        } else {
          this.selectedAccount.set(null);
          this.splits.set(null);
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.popup.error(err?.error?.message || 'Failed to load electricity accounts');
      }
    });
  }

  selectAccount(acc: ElectricityAccount): void {
    this.selectedAccount.set(acc);
    if (acc?.latestBill?.id) {
      this.loadSplits(acc.id, acc.latestBill.id);
    } else {
      this.splits.set(null);
    }
  }

  loadSplits(accountId: number, billId?: number): void {
    this.loadingSplits.set(true);
    this.electricityService.getSplits(accountId, billId).subscribe({
      next: (s) => {
        this.splits.set(s);
        this.loadingSplits.set(false);
      },
      error: () => {
        this.splits.set(null);
        this.loadingSplits.set(false);
      }
    });
  }

  checkBill(): void {
    const acc = this.selectedAccount();
    if (!acc) return;

    if (acc.remainingManualChecksToday <= 0) {
      this.popup.warning("You have reached today's 2 check limit. Next check available tomorrow.");
      return;
    }

    this.checking.set(true);

    this.electricityService.checkBill(acc.id).subscribe({
      next: (res) => {
        this.checking.set(false);
        this.popup.success(res.message || 'Bill check completed!');

        // Update selected account & accounts list
        if (res.account) {
          this.selectedAccount.set(res.account);
          this.accounts.update(list => list.map(a => a.id === res.account.id ? res.account : a));
        }

        if (res.bill?.id) {
          this.loadSplits(acc.id, res.bill.id);
        }
      },
      error: (err) => {
        this.checking.set(false);
        const msg = err?.error?.message || 'Bill check failed';

        if (err?.status === 429 || err?.error?.limitReached) {
          this.popup.warning("You have reached today's 2 check limit.");
          if (err?.error?.account) {
            this.selectedAccount.set(err.error.account);
          } else {
            // Local fallback decrement
            this.selectedAccount.update(cur => cur ? { ...cur, remainingManualChecksToday: 0 } : null);
          }
        } else {
          this.popup.error(msg);
        }
      }
    });
  }

  openAddModal(): void {
    this.showAddModal.set(true);
    this.selectedBillerId = '';
    this.selectedBillerDetail.set(null);
    this.dynamicParamValues = {};
    this.expectedBillDayOfMonth = null;
    this.billerSearch = '';
    this.billerDropdownOpen.set(false);

    if (this.billers().length === 0) {
      this.loadBillers();
    } else {
      const tg = this.billers().find(b => b.id.includes('TGSPDCL')) || this.billers()[0];
      if (tg) {
        this.selectBillerItem(tg);
      }
    }
  }

  toggleBillerDropdown(): void {
    if (this.billers().length === 0) {
      this.loadBillers();
    }
    this.billerDropdownOpen.update(v => !v);
  }

  selectBillerItem(biller: ElectricityBiller): void {
    this.selectedBillerId = biller.id;
    this.billerSearch = biller.name;
    this.billerDropdownOpen.set(false);
    this.onBillerSelect(biller.id);
  }

  clearBillerSelection(): void {
    this.selectedBillerId = '';
    this.billerSearch = '';
    this.selectedBillerDetail.set(null);
    this.dynamicParamValues = {};
    this.billerDropdownOpen.set(true);
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
    this.billerDropdownOpen.set(false);
  }

  loadBillers(): void {
    this.loadingBillers.set(true);
    this.electricityService.getBillers().subscribe({
      next: (list) => {
        this.loadingBillers.set(false);
        this.billers.set(list || []);
        if (list && list.length > 0 && !this.selectedBillerId) {
          const tg = list.find(b => b.id.includes('TGSPDCL')) || list[0];
          this.selectBillerItem(tg);
        }
      },
      error: () => {
        this.loadingBillers.set(false);
        this.popup.error('Failed to load electricity billers');
      }
    });
  }

  onBillerSelect(billerId: string): void {
    this.selectedBillerId = billerId;
    this.dynamicParamValues = {};
    if (!billerId) {
      this.selectedBillerDetail.set(null);
      return;
    }

    this.loadingBillerDetail.set(true);
    this.electricityService.getBillerDetails(billerId).subscribe({
      next: (detail) => {
        this.loadingBillerDetail.set(false);
        this.selectedBillerDetail.set(detail);

        // Initialize param values
        if (detail?.customerParams) {
          for (const p of detail.customerParams) {
            this.dynamicParamValues[p.paramId] = '';
          }
        }
      },
      error: () => {
        this.loadingBillerDetail.set(false);
        this.popup.error('Failed to load biller parameters');
      }
    });
  }

  saveAccount(): void {
    const detail = this.selectedBillerDetail();
    if (!this.selectedBillerId || !detail) {
      this.popup.warning('Please select an electricity biller');
      return;
    }

    // Validate required dynamic parameters
    for (const p of detail.customerParams) {
      if (!p.isOptional) {
        const val = (this.dynamicParamValues[p.paramId] || '').trim();
        if (!val) {
          this.popup.warning(`Please enter ${p.paramName}`);
          return;
        }

        if (p.minLength && val.length < p.minLength) {
          this.popup.warning(`${p.paramName} must be at least ${p.minLength} characters`);
          return;
        }

        if (p.maxLength && val.length > p.maxLength) {
          this.popup.warning(`${p.paramName} cannot exceed ${p.maxLength} characters`);
          return;
        }

        if (p.regex) {
          try {
            const reg = new RegExp(p.regex);
            if (!reg.test(val)) {
              this.popup.warning(`Invalid format for ${p.paramName}`);
              return;
            }
          } catch {
            // Ignore regex syntax errors from provider
          }
        }
      }
    }

    const gIdNum = parseInt(this.groupId(), 10) || 1;
    const payload: CreateElectricityAccountPayload = {
      groupId: gIdNum,
      billerId: this.selectedBillerId,
      customerParameters: this.dynamicParamValues,
      expectedBillDayOfMonth: this.expectedBillDayOfMonth
    };

    this.submitting.set(true);
    this.electricityService.createAccount(payload).subscribe({
      next: (acc) => {
        this.submitting.set(false);
        this.closeAddModal();
        this.popup.success('Electricity account connected to TGSPDCL monitoring!');
        this.loadAccounts();
      },
      error: (err) => {
        this.submitting.set(false);
        this.popup.error(err?.error?.message || 'Failed to save electricity account');
      }
    });
  }

  openLogsModal(): void {
    const acc = this.selectedAccount();
    if (!acc) return;

    this.showLogsModal.set(true);
    this.electricityService.getMonitoringStatus(acc.id).subscribe({
      next: (status) => this.monitoringStatus.set(status),
      error: () => {}
    });
  }

  closeLogsModal(): void {
    this.showLogsModal.set(false);
  }

  goToBills(): void {
    this.router.navigate(['/g', this.groupId(), 'bills']);
  }

  goToDashboard(): void {
    this.router.navigate(['/g', this.groupId(), 'dashboard']);
  }

  getStatusBadgeClass(status?: string): string {
    switch (status) {
      case 'BILL_GENERATED':
        return 'badge-bill-generated';
      case 'MONITORING':
        return 'badge-monitoring';
      case 'NO_BILL':
        return 'badge-no-bill';
      case 'PROVIDER_ERROR':
        return 'badge-error';
      case 'INVALID_CONSUMER':
        return 'badge-invalid';
      default:
        return 'badge-default';
    }
  }

  getStatusLabel(status?: string): string {
    switch (status) {
      case 'BILL_GENERATED':
        return 'Bill Generated';
      case 'MONITORING':
        return 'Monitoring Active';
      case 'NO_BILL':
        return 'No Pending Bill';
      case 'PROVIDER_ERROR':
        return 'TGSPDCL Retry Queued';
      case 'INVALID_CONSUMER':
        return 'Invalid Consumer Info';
      default:
        return status || 'Active';
    }
  }
}
