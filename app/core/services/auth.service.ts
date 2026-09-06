import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { AuthResult, User } from '../../features/shared/models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);

  user = signal<User | null>(this.loadUser());

  login(email: string, password: string) {
    return this.api.post<AuthResult>('auth/login', { email, password });
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('rl_access_token');
  }

  saveSession(result: AuthResult): void {
    localStorage.setItem('rl_access_token', result.accessToken);
    localStorage.setItem('rl_refresh_token', result.refreshToken);
    localStorage.setItem('rl_token_expires', result.accessTokenExpiresAt);
    localStorage.setItem('rl_user', JSON.stringify(result.user));
    this.user.set(result.user);
  }

  logout(): void {
    this.api.post('auth/logout', { refreshToken: localStorage.getItem('rl_refresh_token') })
      .subscribe({ complete: () => this.clearAndGo() });
    setTimeout(() => { if (this.isLoggedIn()) this.clearAndGo(); }, 2000);
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
}
