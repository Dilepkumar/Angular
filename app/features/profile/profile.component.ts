import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { GENDERS, GENDER_ICONS } from '../shared/constants';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './profile.component.html'
})
export class ProfileComponent {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);

  fullName = ''; email = ''; phone = '';
  dob = ''; gender = '';
  today = new Date().toISOString().slice(0, 10);
  avatarUrl = signal<string | null>(null);
  initials = '';
  genders = GENDERS;
  genderIcons = GENDER_ICONS;
  genderOpen = signal(false);

  loading = signal(false);
  saving = signal(false);
  changingPw = signal(false);
  message = signal<string | null>(null);
  pwMessage = signal<string | null>(null);
  pwError = signal<string | null>(null);

  showPwSection = signal(false);
  currentPassword = ''; newPassword = ''; confirmPassword = '';
  showPw = false;

ngOnInit() {
  this.load();
  document.addEventListener('click', this.closeDropdown);
}
ngOnDestroy() {
  document.removeEventListener('click', this.closeDropdown);
}
closeDropdown = (e: Event) => {
  const t = e.target as HTMLElement;
  if (!t.closest('.relative')) this.genderOpen.set(false);
};

  load() {
    this.loading.set(true);
    this.api.get<any>('profile').subscribe({
      next: p => {
        this.fullName = p.fullName ?? '';
        this.email = p.email ?? '';
        this.phone = p.phone ?? '';
        this.dob = p.dateOfBirth ? p.dateOfBirth.split('T')[0] : '';
        this.gender = p.gender ?? '';
        this.avatarUrl.set(p.avatarUrl ?? null);
        this.initials = (p.fullName ?? '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.message.set('Could not load profile'); }
    });
  }

  onFilePicked(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { this.message.set('Image must be under 2 MB'); return; }

    const fd = new FormData();
    fd.append('file', file);
    this.saving.set(true);
    this.api.postForm<{ avatarUrl: string }>('profile/avatar', fd).subscribe({
      next: r => {
        this.avatarUrl.set(r.avatarUrl + '?t=' + Date.now());  // cache-bust
        this.saving.set(false);
        this.message.set('✅ Photo updated');
      },
      error: e => { this.saving.set(false); this.message.set(e.error?.message ?? 'Upload failed'); }
    });
  }

  save() {
    if (this.fullName.trim().length < 2) { this.message.set('Name is too short'); return; }
    this.saving.set(true); this.message.set(null);
    this.api.put<{ message: string }>('profile', {
      fullName: this.fullName.trim(),
      dateOfBirth: this.dob || null,
      gender: this.gender || null
    }).subscribe({
      next: r => {
        this.saving.set(false);
        this.message.set('✅ ' + r.message);
        this.auth.user.update(u => u ? { ...u, fullName: this.fullName.trim() } : u);
        this.initials = this.fullName.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      },
      error: e => { this.saving.set(false); this.message.set(e.error?.message ?? 'Update failed'); }
    });
  }

  changePassword() {
    this.pwError.set(null); this.pwMessage.set(null);
    if (this.newPassword.length < 8) { this.pwError.set('New password must be at least 8 characters'); return; }
    if (this.newPassword !== this.confirmPassword) { this.pwError.set('Passwords do not match'); return; }

    this.changingPw.set(true);
    this.api.post<{ message: string }>('profile/change-password', {
      currentPassword: this.currentPassword, newPassword: this.newPassword
    }).subscribe({
      next: r => {
        this.changingPw.set(false);
        this.pwMessage.set('✅ ' + r.message);
        this.currentPassword = this.newPassword = this.confirmPassword = '';
      },
      error: e => { this.changingPw.set(false); this.pwError.set(e.error?.message ?? 'Change failed'); }
    });
  }

  goHome() {
    this.router.navigateByUrl('/');
  }

  logout() {
    if (confirm('Log out of RoomLedger?')) this.auth.logout();
  }
}
