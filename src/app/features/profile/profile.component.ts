import { Component, OnInit, AfterViewInit, inject, signal, computed, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { GENDERS, GENDER_ICONS } from '../shared/constants';
import * as QRCode from 'qrcode';

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
  isEditingUpi = signal(false);
  tempUpiId = signal('');

  // Stats & Membership Signals
  roomName = signal('');
  roomAddress = signal('');
  roomRole = signal('');
  memberCount = signal(0);
  owedToYou = signal(0);
  inviteCode = signal('');
  groupId = signal<number | null>(null);

  // Roommates Modal State
  roommates = signal<any[]>([]);
  adminMember = computed(() => this.roommates().find(m => m.role?.toLowerCase() === 'admin'));
  showRoommatesModal = signal<boolean>(false);

  // Inactivate Flat State
  showInactivateModal = signal<boolean>(false);
  inactivatingFlat = signal<boolean>(false);
  inactivateError = signal<string | null>(null);

  // Invite Modal State
  showInviteModal = signal<boolean>(false);
  inviteCodeCopied = signal<boolean>(false);
  inviteLinkCopied = signal<boolean>(false);

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
  showUpiSection = signal(false);
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
      this.upiId.set((localUser as any).upiId || '');
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
        this.roommates.set(p.members || []);
        this.owedToYou.set(p.owedToYou ?? 0);
        this.inviteCode.set(p.inviteCode ?? '');
        this.groupId.set(p.groupId ?? (savedGroupId ? Number(savedGroupId) : null));

        if (p.groupId && !savedGroupId) {
          localStorage.setItem('rl_group_id', String(p.groupId));
        }

        // Dynamic nickname, initials & UPI ID
        this.nickname.set(p.nickname || this.getNickname(name));
        this.initials.set(this.getInitials(name));
        this.upiId.set(p.upiId || '');
        this.tempUpiId.set(p.upiId || '');

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

  getInitials(name: string): string {
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

  onUpiIdChange(val: string): void {
    this.tempUpiId.set(val);
  }

  startEditingUpi(): void {
    this.tempUpiId.set(this.upiId());
    this.isEditingUpi.set(true);
  }

  cancelEditingUpi(): void {
    this.tempUpiId.set(this.upiId());
    this.isEditingUpi.set(false);
  }

  savingUpi = signal(false);

  saveUpiId(): void {
    const upi = this.tempUpiId().trim();
    if (upi && !upi.includes('@')) {
      this.showToast('⚠️ Please enter a valid UPI ID (e.g. username@bank or mobile@upi)');
      return;
    }

    this.savingUpi.set(true);
    this.api.put<{ message: string }>('profile', {
      fullName: this.fullName().trim(),
      dateOfBirth: this.dob() || null,
      gender: this.gender() || null,
      phone: this.phone().trim() || null,
      upiId: upi || null
    }).subscribe({
      next: () => {
        this.savingUpi.set(false);
        this.upiId.set(upi);
        this.isEditingUpi.set(false);
        this.showToast('✅ UPI ID saved! Flatmates can now pay you directly.');
        this.cdr.detectChanges();
        setTimeout(() => this.drawQrCode(), 50);
      },
      error: (err: any) => {
        this.savingUpi.set(false);
        this.showToast(`❌ ${err?.error?.message || 'Failed to save UPI ID'}`);
      }
    });
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
      phone: this.phone().trim() || null,
      upiId: this.upiId().trim() || null
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

  // ═══════════════════════════════════════════
  // ROOMMATES MODAL
  // ═══════════════════════════════════════════
  openRoommatesModal(): void {
    if (this.roommates().length === 0 && this.groupId()) {
      this.api.get<any>(`groups/${this.groupId()}`).subscribe({
        next: (g) => {
          if (g?.members) {
            this.roommates.set(g.members);
          }
          this.showRoommatesModal.set(true);
        },
        error: () => {
          this.showRoommatesModal.set(true);
        }
      });
    } else {
      this.showRoommatesModal.set(true);
    }
  }

  closeRoommatesModal(): void {
    this.showRoommatesModal.set(false);
  }

  removingMember = signal<boolean>(false);

  removeMember(m: any): void {
    const gid = this.groupId() || localStorage.getItem('rl_group_id');
    if (!gid) return;

    const confirmMsg = `Are you sure you want to remove ${m.name || 'this member'} from the flat?\n\nThe system will verify that they have zero unsettled IOUs, unpaid bills, and unreimbursed pool expenses before removing.`;
    if (!confirm(confirmMsg)) return;

    this.removingMember.set(true);
    this.api.post<{ message: string }>(`groups/${gid}/members/${m.id}/remove`, {}).subscribe({
      next: (res) => {
        this.removingMember.set(false);
        this.showToast(`✅ ${res.message || 'Member removed successfully.'}`);
        this.loadProfile();
        this.closeRoommatesModal();
      },
      error: (err) => {
        this.removingMember.set(false);
        this.showToast(`❌ ${err.error?.message || 'Failed to remove member'}`);
      }
    });
  }

  // ═══════════════════════════════════════════
  // INACTIVATE / ARCHIVE FLAT (ADMIN ONLY)
  // ═══════════════════════════════════════════
  openInactivateModal(): void {
    this.inactivateError.set(null);
    this.showInactivateModal.set(true);
  }

  closeInactivateModal(): void {
    this.showInactivateModal.set(false);
    this.inactivateError.set(null);
  }

  confirmInactivateFlat(): void {
    const gid = this.groupId() || localStorage.getItem('rl_group_id');
    if (!gid) return;

    this.inactivatingFlat.set(true);
    this.inactivateError.set(null);

    this.api.post<{ message: string }>(`groups/${gid}/inactivate`, {}).subscribe({
      next: (res) => {
        this.inactivatingFlat.set(false);
        this.showInactivateModal.set(false);
        this.showToast(`✅ ${res.message || 'Flat has been deactivated and archived.'}`);
        localStorage.removeItem('rl_group_id');
        localStorage.removeItem('rl_user_groups');
        setTimeout(() => {
          this.router.navigate(['/groups']);
        }, 1200);
      },
      error: (err: any) => {
        this.inactivatingFlat.set(false);
        const msg = err.error?.message || 'Failed to inactivate flat. Ensure all debts, bills, and pool balances are settled.';
        this.inactivateError.set(msg);
        this.showToast(`❌ ${msg}`);
      }
    });
  }

  // ═══════════════════════════════════════════
  // ROOM NAVIGATION & SHARE INVITE MODAL
  // ═══════════════════════════════════════════
  goToRoom(): void {
    const gid = this.groupId() || localStorage.getItem('rl_group_id');
    if (gid) {
      this.router.navigate(['/g', gid, 'dashboard']);
    } else {
      this.router.navigate(['/']);
    }
  }

  toggleUpiSection(): void {
    const next = !this.showUpiSection();
    this.showUpiSection.set(next);
    if (next) {
      setTimeout(() => this.drawQrCode(), 80);
    }
  }

  getInviteUrl(): string {
    const code = this.inviteCode();
    return code ? `${window.location.origin}/join/${code}` : '';
  }

  getWhatsAppShareUrl(): string {
    const text = encodeURIComponent(
      `Hey! Join our flat "${this.roomName()}" on RoomLedger to split expenses and bills easily:\n\nJoin Link: ${this.getInviteUrl()}\nInvite Code: ${this.inviteCode()}`
    );
    return `https://api.whatsapp.com/send?text=${text}`;
  }

  shareInvite(): void {
    const code = this.inviteCode();
    if (!code) {
      this.showToast('⚠️ No active invite code for this room');
      return;
    }
    this.inviteCodeCopied.set(false);
    this.inviteLinkCopied.set(false);
    this.showInviteModal.set(true);
  }

  closeInviteModal(): void {
    this.showInviteModal.set(false);
  }

  copyInviteCode(): void {
    const code = this.inviteCode();
    if (!code) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        this.inviteCodeCopied.set(true);
        setTimeout(() => this.inviteCodeCopied.set(false), 2500);
      });
    } else {
      this.showToast(`🔑 Code: ${code}`);
    }
  }

  copyInviteLink(): void {
    const url = this.getInviteUrl();
    if (!url) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        this.inviteLinkCopied.set(true);
        setTimeout(() => this.inviteLinkCopied.set(false), 2500);
      });
    } else {
      this.showToast(`🔗 Link: ${url}`);
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
    const upi = this.upiId().trim();
    if (!cv) return;

    if (!upi) {
      const ctx = cv.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, cv.width, cv.height);
      return;
    }

    const name = this.fullName().trim() || 'Roommate';
    // Standard NPCI UPI URI Specification — 100% compliant with GPay, PhonePe, Paytm, BHIM & Google Lens
    const upiUri = `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(name)}&cu=INR`;

    QRCode.toCanvas(cv, upiUri, {
      width: 150,
      margin: 1,
      color: {
        dark: '#111827',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    }, (err: any) => {
      if (err) {
        console.error('Failed to generate UPI QR code:', err);
      }
    });
  }

  showToast(msg: string): void {
    this.toastMessage.set(msg);
    this.cdr.detectChanges();
    setTimeout(() => {
      this.toastMessage.set(null);
      this.cdr.detectChanges();
    }, 3200);
  }

  showLogoutModal = signal<boolean>(false);

  goBack(): void {
    this.router.navigate(['/']);
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

