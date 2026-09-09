import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
  private router = inject(Router);

  groups = signal<MyGroup[]>([]);
  loading = signal(false);
  submitting = signal(false);
  error = signal<string | null>(null);

  // Modal: 'create' | 'join' | null
  modalMode = signal<'create' | 'join' | null>(null);
  
  // Form models
  newGroupName = '';
  newGroupTarget: number | null = 20000;
  inviteCode = '';

  ngOnInit(): void {
    this.loadGroups();
  }

  loadGroups(): void {
    this.loading.set(true);
    this.api.get<MyGroup[]>('groups/my').subscribe({
      next: (data) => {
        this.groups.set(data || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        // Fallback demo flat if API returns empty
        if (this.groups().length === 0) {
          this.groups.set([
            {
              id: 1,
              groupName: 'Apartment 402',
              monthlyPoolTarget: 20000,
              inviteCode: 'APT402',
              memberCount: 7,
              myRole: 'Admin'
            }
          ]);
        }
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
      monthlyPoolTarget: this.newGroupTarget ?? 0
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

  goProfile(): void {
    this.router.navigateByUrl('/profile');
  }

  logout(): void {
    if (confirm('Log out of RoomLedger?')) {
      this.auth.logout();
    }
  }
}
