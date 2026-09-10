import { Component, OnInit, AfterViewInit, inject, signal, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { GENDERS, GENDER_ICONS } from '../shared/constants';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit, AfterViewInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('qrCanvas') qrCanvasRef!: ElementRef<HTMLCanvasElement>;

  // User details as Signals for instant, reactive Zoneless binding
  fullName = signal('');
  nickname = signal('');
  email = signal('');
  phone = signal('');
  dob = signal('');
  gender = signal('');
  today = new Date().toISOString().slice(0, 10);
  upiId = signal('');

  // Stats & Membership Signals
  roomName = signal('');
  roomAddress = signal('');
  roomRole = signal('');
  memberCount = signal(0);
  owedToYou = signal(0);
  inviteCode = signal('');
  groupId = signal<number | null>(null);

  // Notification Toggles
  pushEnabled = signal(true);
  whatsappEnabled = signal(true);
  emailDigestEnabled = signal(false);

  avatarUrl = signal<string | null>(null);
  initials = signal('');
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
    // 1. Immediately seed from logged-in user so the page is never blank on arrival
    this.seedFromCurrentUser();

    // 2. Fetch fresh dynamic data from the backend
    this.loadProfile();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.drawQrCode(), 100);
  }

  private seedFromCurrentUser(): void {
    const localUser = this.auth.user();
    if (localUser) {
      const name = localUser.fullName || '';
      const email = localUser.email || '';
      const phone = (localUser as any).phone || '';
      this.fullName.set(name);
      this.email.set(email);
      this.phone.set(phone);
      this.initials.set(this.getInitials(name));
      this.nickname.set(this.getNickname(name));
      this.upiId.set(this.getUpiId(email, name));
      if (localUser.avatarUrl) {
        this.avatarUrl.set(localUser.avatarUrl);
      }
    }
  }

  loadProfile(): void {
    this.loading.set(true);
    const savedGroupId = localStorage.getItem('rl_group_id');
    const endpoint = savedGroupId ? `profile?groupId=${savedGroupId}` : 'profile';

    this.api.get<any>(endpoint).subscribe({
      next: (p) => {
        const name = p.fullName ?? this.fullName();
        const mail = p.email ?? this.email();
        const ph = p.phone ?? this.phone();

        this.fullName.set(name);
        this.email.set(mail);
        this.phone.set(ph);
        this.dob.set(p.dateOfBirth ? p.dateOfBirth.split('T')[0] : '');
        this.gender.set(p.gender ?? '');
        this.avatarUrl.set(p.avatarUrl ?? null);

        // Room and stats
        this.roomName.set(p.roomName ?? 'No Flat Joined');
        this.roomAddress.set(p.roomAddress ?? '');
        this.roomRole.set(p.roomRole ?? 'Member');
        this.memberCount.set(p.memberCount ?? 0);
        this.owedToYou.set(p.owedToYou ?? 0);
        this.inviteCode.set(p.inviteCode ?? '');
        this.groupId.set(p.groupId ?? (savedGroupId ? Number(savedGroupId) : null));

        if (p.groupId && !savedGroupId) {
          localStorage.setItem('rl_group_id', String(p.groupId));
        }

        // Dynamic nickname, initials & UPI ID
        this.nickname.set(p.nickname || this.getNickname(name));
        this.initials.set(this.getInitials(name));
        this.upiId.set(p.upiId || this.getUpiId(mail, name));

        this.loading.set(false);
        this.cdr.detectChanges();
        setTimeout(() => this.drawQrCode(), 50);
      },
      error: () => {
        this.loading.set(false);
        this.cdr.detectChanges();
        setTimeout(() => this.drawQrCode(), 50);
      }
    });
  }

  private getInitials(name: string): string {
    if (!name?.trim()) return 'DK';
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  private getNickname(name: string): string {
    if (!name?.trim()) return 'user';
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) {
      return parts.map(w => w[0]).join('').toUpperCase();
    }
    return parts[0].toLowerCase();
  }

  private getUpiId(email: string, name: string): string {
    if (email) {
      return `${email.split('@')[0]}@okhdfcbank`;
    }
    if (name) {
      return `${name.toLowerCase().replace(/\s+/g, '')}@okhdfcbank`;
    }
    return 'user@okhdfcbank';
  }

  onUpiIdChange(val: string): void {
    this.upiId.set(val);
    this.drawQrCode();
  }

  saveProfile(): void {
    const currentName = this.fullName().trim();
    if (currentName.length < 2) {
      this.showToast('⚠️ Full name must be at least 2 characters');
      return;
    }

    this.saving.set(true);
    this.api.put<{ message: string }>('profile', {
      fullName: currentName,
      dateOfBirth: this.dob() || null,
      gender: this.gender() || null,
      phone: this.phone().trim() || null
    }).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.showToast('✅ Profile saved successfully!');
        this.auth.user.update(u => u ? { ...u, fullName: currentName } : u);
        this.initials.set(this.getInitials(currentName));
        this.nickname.set(this.getNickname(currentName));
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.saving.set(false);
        this.showToast(err.error?.message ?? '⚠️ Update failed');
        this.cdr.detectChanges();
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
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.saving.set(false);
        this.showToast(err.error?.message ?? '⚠️ Photo upload failed');
        this.cdr.detectChanges();
      }
    });
  }

  copyUpiId(): void {
    const upi = this.upiId();
    if (!upi) {
      this.showToast('⚠️ No UPI ID available to copy');
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(upi).then(() => {
        this.showToast('📋 UPI ID copied to clipboard!');
      });
    } else {
      this.showToast('📋 UPI ID: ' + upi);
    }
  }

  shareInvite(): void {
    const code = this.inviteCode();
    if (!code) {
      this.showToast('⚠️ No active invite code for this room');
      return;
    }
    const inviteUrl = `${window.location.origin}/join/${code}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(inviteUrl).then(() => {
        this.showToast(`🔗 Invite copied: ${inviteUrl}`);
      });
    } else {
      this.showToast(`🔗 Invite: ${inviteUrl}`);
    }
  }

  leaveRoom(): void {
    this.router.navigate(['/groups']);
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
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.changingPw.set(false);
        this.pwError.set(err.error?.message ?? 'Password change failed');
        this.cdr.detectChanges();
      }
    });
  }

  drawQrCode(): void {
    const cv = this.qrCanvasRef?.nativeElement;
    if (!cv) return;
    const text = this.upiId() || 'upi://pay';
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
          dk = (lr === 0 || lr === 6 || lc === 0 || lc === 6) || (lr >= 2 && r <= 4 && lc >= 2 && lc <= 4);
        } else if (bl) {
          const lr = r - (m - 7), lc = c;
          dk = (lr === 0 || lr === 6 || lc === 0 || lc === 6) || (lr >= 2 && r <= 4 && lc >= 2 && lc <= 4);
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
    this.cdr.detectChanges();
    setTimeout(() => {
      this.toastMessage.set(null);
      this.cdr.detectChanges();
    }, 3200);
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
