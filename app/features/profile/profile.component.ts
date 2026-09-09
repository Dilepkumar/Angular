import { Component, OnInit, AfterViewInit, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { GENDERS, GENDER_ICONS } from '../shared/constants';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit, AfterViewInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);

  @ViewChild('qrCanvas') qrCanvasRef!: ElementRef<HTMLCanvasElement>;

  // User details
  fullName = '';
  nickname = '';
  email = '';
  phone = '';
  dob = '';
  gender = '';
  today = new Date().toISOString().slice(0, 10);
  upiId = 'dileep@okhdfcbank';

  // Stats & Membership
  roomName = 'Apartment 402';
  roomAddress = 'HSR Layout, Bangalore';
  roomRole = 'Room Admin';
  memberCount = 7;
  owedToYou = 1850;

  // Notification Toggles
  pushEnabled = signal(true);
  whatsappEnabled = signal(true);
  emailDigestEnabled = signal(false);

  avatarUrl = signal<string | null>(null);
  initials = 'DK';
  genders = GENDERS;
  genderIcons = GENDER_ICONS;

  // UI state
  loading = signal(false);
  saving = signal(false);
  changingPw = signal(false);
  showPwSection = signal(false);
  toastMessage = signal<string | null>(null);
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  showPw = false;
  pwError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadProfile();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.drawQrCode(), 100);
  }

  loadProfile(): void {
    this.loading.set(true);
    this.api.get<any>('profile').subscribe({
      next: (p) => {
        this.fullName = p.fullName ?? '';
        this.email = p.email ?? '';
        this.phone = p.phone ?? '';
        this.dob = p.dateOfBirth ? p.dateOfBirth.split('T')[0] : '';
        this.gender = p.gender ?? '';
        this.avatarUrl.set(p.avatarUrl ?? null);
        
        // Generate nickname/initials
        const parts = (p.fullName || '').trim().split(' ');
        this.nickname = parts.length > 1 ? parts.map((w: string) => w[0]).join('').toUpperCase() : parts[0] || 'DK';
        this.initials = (p.fullName ?? 'DK').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
        
        // Default UPI ID based on user email or name
        if (!this.upiId || this.upiId === 'dileep@okhdfcbank') {
          const userPrefix = this.email ? this.email.split('@')[0] : 'user';
          this.upiId = `${userPrefix}@okhdfcbank`;
        }

        this.loading.set(false);
        setTimeout(() => this.drawQrCode(), 80);
      },
      error: () => {
        // Fallback to local stored user if offline
        const localUser = this.auth.user();
        if (localUser) {
          this.fullName = localUser.fullName || 'Dileep Kumar';
          this.email = localUser.email || 'dileep@roomledger.app';
          this.phone = (localUser as any).phone || '9876543210';
          this.initials = this.fullName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
        }
        this.loading.set(false);
        setTimeout(() => this.drawQrCode(), 80);
      }
    });
  }

  saveProfile(): void {
    if (this.fullName.trim().length < 2) {
      this.showToast('⚠️ Full name must be at least 2 characters');
      return;
    }

    this.saving.set(true);
    this.api.put<{ message: string }>('profile', {
      fullName: this.fullName.trim(),
      dateOfBirth: this.dob || null,
      gender: this.gender || null
    }).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.showToast('✅ Profile saved successfully!');
        this.auth.user.update(u => u ? { ...u, fullName: this.fullName.trim() } : u);
        this.initials = this.fullName.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      },
      error: (err: any) => {
        this.saving.set(false);
        this.showToast(err.error?.message ?? '⚠️ Update failed');
      }
    });
  }

  onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      this.showToast('⚠️ Image must be under 2 MB');
      return;
    }

    const fd = new FormData();
    fd.append('file', file);
    this.saving.set(true);
    this.api.postForm<{ avatarUrl: string }>('profile/avatar', fd).subscribe({
      next: (res) => {
        this.avatarUrl.set(res.avatarUrl + '?t=' + Date.now());
        this.saving.set(false);
        this.showToast('✅ Profile photo updated!');
      },
      error: (err: any) => {
        this.saving.set(false);
        this.showToast(err.error?.message ?? '⚠️ Photo upload failed');
      }
    });
  }

  copyUpiId(): void {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(this.upiId).then(() => {
        this.showToast('📋 UPI ID copied to clipboard!');
      });
    } else {
      this.showToast('📋 UPI ID: ' + this.upiId);
    }
  }

  shareInvite(): void {
    const inviteUrl = 'https://roomledger.app/join/APT402';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(inviteUrl).then(() => {
        this.showToast('🔗 Invite copied: roomledger.app/join/APT402');
      });
    } else {
      this.showToast('🔗 Invite: ' + inviteUrl);
    }
  }

  leaveRoom(): void {
    this.showToast('⚠️ Leaving room requires admin handover');
  }

  changePassword(): void {
    this.pwError.set(null);
    if (this.newPassword.length < 8) {
      this.pwError.set('New password must be at least 8 characters');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.pwError.set('Passwords do not match');
      return;
    }

    this.changingPw.set(true);
    this.api.post<{ message: string }>('profile/change-password', {
      currentPassword: this.currentPassword,
      newPassword: this.newPassword
    }).subscribe({
      next: (r) => {
        this.changingPw.set(false);
        this.showToast('✅ Password changed successfully!');
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.showPwSection.set(false);
      },
      error: (err: any) => {
        this.changingPw.set(false);
        this.pwError.set(err.error?.message ?? 'Password change failed');
      }
    });
  }

  drawQrCode(): void {
    const cv = this.qrCanvasRef?.nativeElement;
    if (!cv) return;
    const text = this.upiId || 'dileep@okhdfcbank';
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

    // Splitwise Teal central badge
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

  showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(null), 3200);
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  logout(): void {
    if (confirm('Are you sure you want to log out of RoomLedger?')) {
      this.auth.logout();
    }
  }
}
