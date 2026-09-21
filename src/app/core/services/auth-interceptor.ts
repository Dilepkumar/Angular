import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, Observable, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

let refreshInProgress$: Observable<string> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const http = inject(HttpClient);
  const router = inject(Router);
  const token = localStorage.getItem('rl_access_token');
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || req.url.includes('/auth/')) {
        return throwError(() => err);
      }

      const refresh = localStorage.getItem('rl_refresh_token');
      if (!refresh) {
        localStorage.removeItem('rl_access_token');
        localStorage.removeItem('rl_refresh_token');
        router.navigate(['/auth/login']);
        return throwError(() => err);
      }

      // If a refresh is not already in flight, initialize the shared observable
      if (!refreshInProgress$) {
        refreshInProgress$ = http.post<{ accessToken: string; refreshToken: string }>(
          `${environment.apiUrl}auth/refresh`,
          { refreshToken: refresh }
        ).pipe(
          tap({
            next: (res) => {
              localStorage.setItem('rl_access_token', res.accessToken);
              localStorage.setItem('rl_refresh_token', res.refreshToken);
              refreshInProgress$ = null;
            },
            error: () => {
              refreshInProgress$ = null;
              localStorage.removeItem('rl_access_token');
              localStorage.removeItem('rl_refresh_token');
              router.navigate(['/auth/login']);
            }
          }),
          map(res => res.accessToken),
          shareReplay(1)
        );
      }

      return refreshInProgress$.pipe(
        switchMap(newToken => next(req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })))
      );
    })
  );
};
