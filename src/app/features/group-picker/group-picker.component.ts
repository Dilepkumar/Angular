import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

export interface MyGroup {
  id: number;
  groupName: string;
  monthlyPoolTarget: number;
  inviteCode: string | null;
  memberCount: number;
  myRole: string | null;
}

@Component({
  selector: 'app-group-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './group-picker.component.html',
  styleUrls: ['./group-picker.component.scss']
})
export class GroupPickerComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  groups = signal<MyGroup[]>([]);
  loading = signal(false);
  submitting = signal(false);
  error = signal<string | null>(null);

  // Modal: 'create' | 'join' | null
  modalMode = signal<'create' | 'join' | null>(null);
  
  // Form models
  newGroupName = '';
  newGroupAddress = '';
  newGroupTarget: number | null = 20000;
  inviteCode = '';

  get isSwitching(): boolean {
    return this.router.url.includes('/groups') || this.route.snapshot.queryParamMap.get('switch') === 'true';
  }

  ngOnInit(): void {
    const cached = localStorage.getItem('rl_user_groups');
    const savedGroupId = localStorage.getItem('rl_group_id');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.groups.set(parsed);
          // Instant restore on normal app launch, but allow staying on groups picker when switching flats
          if (!this.isSwitching && savedGroupId && parsed.some((g: MyGroup) => g.id === Number(savedGroupId))) {
            this.enter(Number(savedGroupId));
            return;
          }
        }
      } catch {}
    }

    this.loadGroups();
  }

  loadGroups(): void {
    this.loading.set(true);
    this.api.get<MyGroup[]>('groups/my').subscribe({
      next: (data) => {
        const list = data || [];
        this.groups.set(list);
        this.loading.set(false);
        try {
          localStorage.setItem('rl_user_groups', JSON.stringify(list));
        } catch {}

        if (!this.isSwitching) {
          const savedGroupId = localStorage.getItem('rl_group_id');
          if (savedGroupId && list.some(g => g.id === Number(savedGroupId))) {
            this.enter(Number(savedGroupId));
          } else if (list.length === 1) {
            this.enter(list[0].id);
          }
        }
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  enter(groupId: number): void {
    localStorage.setItem('rl_group_id', String(groupId));
    this.router.navigate(['/g', groupId, 'dashboard']);
  }

  openCreate(): void {
    this.modalMode.set('create');
    this.error.set(null);
  }

  openJoin(): void {
    this.modalMode.set('join');
    this.error.set(null);
  }

  closeModal(): void {
    this.modalMode.set(null);
    this.error.set(null);
    this.newGroupName = '';
    this.newGroupAddress = '';
  }

  createGroup(): void {
    if (!this.newGroupName.trim()) {
      this.error.set('Please enter a flat name');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.api.post<{ id: number; inviteCode?: string }>('groups', {
      groupName: this.newGroupName.trim(),
      monthlyPoolTarget: this.newGroupTarget ?? 0,
      address: this.newGroupAddress.trim() || undefined
    }).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.closeModal();
        this.enter(res.id);
      },
      error: (err: any) => {
        this.submitting.set(false);
        this.error.set(err.error?.message ?? 'Failed to create group. Please try again.');
      }
    });
  }

  joinByCode(): void {
    const code = this.inviteCode.trim().toUpperCase();
    if (!code) {
      this.error.set('Please enter a 6-digit room code');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.api.post<{ groupId: number; groupName?: string }>('groups/join', { code }).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.closeModal();
        this.enter(res.groupId);
      },
      error: (err: any) => {
        this.submitting.set(false);
        this.error.set(err.error?.message ?? 'Invalid invite code. Check with your flat admin.');
      }
    });
  }

  get me() {
    return this.auth.user();
  }

  get firstName(): string {
    const name = this.me?.fullName || 'Dileep';
    return name.split(' ')[0];
  }

  get initials(): string {
    const n = this.me?.fullName || 'Dileep Kumar';
    return n.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  }

  showLogoutModal = signal<boolean>(false);

  goProfile(): void {
    this.router.navigateByUrl('/profile');
  }

  logout(): void {
    this.showLogoutModal.set(true);
  }

  confirmLogout(): void {
    this.showLogoutModal.set(false);
    this.auth.logout();
  }

  cancelLogout(): void {
    this.showLogoutModal.set(false);
  }
}

