import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./auth.component').then(m => m.AuthComponent) },
  { path: 'register', loadComponent: () => import('./auth.component').then(m => m.AuthComponent) },
  { path: 'verify-otp', loadComponent: () => import('./verify-otp/verify-otp.component').then(m => m.VerifyOtpComponent) },
  { path: 'forgot-password', loadComponent: () => import('./forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent) },
];
