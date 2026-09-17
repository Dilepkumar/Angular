import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  { path: 'auth', loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/group-picker/group-picker.component').then(m => m.GroupPickerComponent)
  },
  {
    path: 'g/:groupId',
    canActivate: [authGuard],
    loadComponent: () => import('./features/tabs/tabs.component').then(m => m.TabsComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'iou', loadComponent: () => import('./features/iou/iou.component').then(m => m.IouComponent) },
      { path: 'bills', loadComponent: () => import('./features/bills/bills.component').then(m => m.BillsComponent) },
      { path: 'pool', loadComponent: () => import('./features/pool/pool.component').then(m => m.PoolComponent) },
      { path: 'log-expense', loadComponent: () => import('./features/pool/log-expense/log-expense.component').then(m => m.LogExpenseComponent) },
      { path: 'history', loadComponent: () => import('./features/pool/history/history.component').then(m => m.HistoryComponent) },
    ]
  },
  { path: 'notifications', canActivate: [authGuard],
    loadComponent: () => import('./features/notifications/notifications.component').then(m => m.NotificationsComponent) },
  { path: 'profile',
    loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent) },
  { path: '**', redirectTo: '' },
];
