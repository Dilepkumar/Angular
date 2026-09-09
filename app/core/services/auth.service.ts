import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { User } from '../../features/shared/models';

export interface LoginResponse {
  token: string;
  refreshToken?: string;
  user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);

  user = signal<User | null>(this.loadUser());

  register(body: { fullName: string; email: string; phone: string; password: string; roomInviteCode?: string }) {
    return this.api.post<LoginResponse>('auth/register', body);
  }

  verifyOtp(email: string, code: string) {
    return this.api.post<{ message: string }>('auth/verify-otp', { email, code });
  }

  login(identifier: string, password: string) {
    return this.api.post<LoginResponse>('auth/login', { identifier, password });
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('rl_access_token');
  }

  saveSession(result: LoginResponse): void {
    localStorage.setItem('rl_access_token', result.token);
    if (result.refreshToken) localStorage.setItem('rl_refresh_token', result.refreshToken);
    localStorage.setItem('rl_user', JSON.stringify(result.user));
    this.user.set(result.user);
  }

  logout(): void {
    this.clearAndGo();
  }

  private loadUser(): User | null {
    const raw = localStorage.getItem('rl_user');
    return raw ? JSON.parse(raw) : null;
  }

  private clearAndGo(): void {
    localStorage.clear();
    this.user.set(null);
    this.router.navigate(['/auth/login']);
  }

  forgotPassword(email: string) {
    return this.api.post<{ message: string; devOtp?: string }>('auth/forgot-password', { email });
  }

  resetPassword(email: string, code: string, newPassword: string) {
    return this.api.post<{ message: string }>('auth/reset-password', { email, code, newPassword });
  }
}
