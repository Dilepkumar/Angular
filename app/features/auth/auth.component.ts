import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, LoginResponse } from '../../core/services/auth.service';

const EMAIL_RE = /^[\w.+-]+@[\w-]+\.[\w.-]{2,}$/;
const PHONE_RE = /^(\+91[\s-]?)?[6-9]\d{9}$/;

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss']
})
export class AuthComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Active Tab: 'login' | 'register'
  activeTab = signal<'login' | 'register'>('login');
  
  // Login Sub-mode: 'email' | 'phone'
  loginMode = signal<'email' | 'phone'>('email');

  loading = signal(false);
  error = signal<string | null>(null);
  toastMsg = signal<string | null>(null);
  showMobileHeroDemo = signal(false);

  // ── Login State ──
  emailLogin = 'dileep@roomledger.app';
  phoneLogin = '9876543210';
  loginPassword = '';
  showLoginPw = false;
  loginTouched = signal(false);

  // ── Register State ──
  regFullName = '';
  regPhone = '';
  regEmail = '';
  regPassword = '';
  regRoomCode = 'APT402';
  showRegPw = false;
  regTouched = signal(false);

  ngOnInit(): void {
    const path = this.route.snapshot.url[0]?.path;
    const tabParam = this.route.snapshot.queryParamMap.get('tab');
    if (path === 'register' || tabParam === 'register') {
      this.activeTab.set('register');
    } else {
      this.activeTab.set('login');
    }
  }

  setTab(tab: 'login' | 'register'): void {
    this.activeTab.set(tab);
    this.error.set(null);
  }

  setLoginMode(mode: 'email' | 'phone'): void {
    this.loginMode.set(mode);
    this.error.set(null);
    this.loginTouched.set(false);
  }

  toggleMobileDemo(): void {
    this.showMobileHeroDemo.update(v => !v);
  }

  // ── Login Validators ──
  get emailLoginError(): string | null {
    const v = this.emailLogin.trim();
    if (!v) return 'Email address is required';
    if (!EMAIL_RE.test(v)) return 'Enter a valid email address';
    return null;
  }

  get phoneLoginError(): string | null {
    const v = this.phoneLogin.replace(/[\s-]/g, '');
    if (!v) return 'Mobile number is required';
    if (!PHONE_RE.test(this.phoneLogin)) return 'Enter a valid 10-digit mobile number';
    return null;
  }

  get loginIdentifierError(): string | null {
    return this.loginMode() === 'email' ? this.emailLoginError : this.phoneLoginError;
  }

  get loginPasswordError(): string | null {
    if (!this.loginPassword) return 'Password is required';
    return null;
  }

  // ── Register Validators ──
  get regNameError(): string | null {
    const v = this.regFullName.trim();
    if (!v) return 'Full name is required';
    if (v.length < 2) return 'Name must be at least 2 characters';
    return null;
  }

  get regPhoneError(): string | null {
    const v = this.regPhone.replace(/[\s-]/g, '');
    if (!v) return 'Mobile number is required';
    if (!PHONE_RE.test(this.regPhone)) return 'Enter a valid 10-digit mobile number';
    return null;
  }

  get regEmailError(): string | null {
    const v = this.regEmail.trim();
    if (!v) return 'Email is required';
    if (!EMAIL_RE.test(v)) return 'Enter a valid email address';
    return null;
  }

  get regPasswordError(): string | null {
    const v = this.regPassword;
    if (!v) return 'Password is required';
    if (v.length < 8) return 'Password must be at least 8 characters';
    return null;
  }

  // ── Password Strength Meter ──
  get pwScore(): number {
    const pw = this.regPassword;
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  }

  get pwScoreLabel(): string {
    if (!this.regPassword) return 'Enter a password';
    const labels = ['Too weak', 'Weak', 'Fair — add numbers', 'Good — add symbols', 'Strong ✓'];
    return labels[this.pwScore] || 'Weak';
  }

  get pwScoreWidth(): string {
    if (!this.regPassword) return '0%';
    return `${(this.pwScore / 4) * 100}%`;
  }

  get pwScoreColor(): string {
    const colors = ['var(--err)', 'var(--err)', 'var(--warn)', 'var(--p2)', 'var(--ok)'];
    return colors[this.pwScore] || 'var(--err)';
  }

  get hasValidRoomCode(): boolean {
    return this.regRoomCode.trim().length >= 4;
  }

  // ── Submit Handlers ──
  submitLogin(): void {
    this.loginTouched.set(true);
    if (this.loginIdentifierError || this.loginPasswordError || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    const identifier = this.loginMode() === 'email' ? this.emailLogin.trim() : this.phoneLogin.trim();

    this.auth.login(identifier, this.loginPassword).subscribe({
      next: (res: LoginResponse) => {
        this.auth.saveSession(res);
        this.showToast(`✅ Welcome back, ${res.user?.fullName || 'User'}!`);
        setTimeout(() => this.router.navigate(['/']), 400);
      },
      error: (err: any) => {
        this.error.set(err.error?.message ?? 'Invalid email/phone or password');
        this.loading.set(false);
      }
    });
  }

  submitRegister(): void {
    this.regTouched.set(true);
    if (this.regNameError || this.regPhoneError || this.regEmailError || this.regPasswordError || this.loading()) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.auth.register({
      fullName: this.regFullName.trim(),
      email: this.regEmail.trim().toLowerCase(),
      phone: this.regPhone.replace(/[\s-]/g, ''),
      password: this.regPassword,
      roomInviteCode: this.regRoomCode.trim() || undefined
    }).subscribe({
      next: (res: LoginResponse) => {
        if (res && res.token) {
          this.auth.saveSession(res);
          this.showToast(`🎉 Welcome to Apartment 402, ${res.user?.fullName || this.regFullName}!`);
          setTimeout(() => this.router.navigate(['/']), 500);
        } else {
          this.showToast('🎉 Account created! Please sign in.');
          this.setTab('login');
          this.emailLogin = this.regEmail;
          this.loginMode.set('email');
          this.loading.set(false);
        }
      },
      error: (err: any) => {
        this.error.set(err.error?.message ?? 'Registration failed. Please check your details.');
        this.loading.set(false);
      }
    });
  }

  private showToast(msg: string): void {
    this.toastMsg.set(msg);
    setTimeout(() => this.toastMsg.set(null), 3500);
  }
}
