import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from './loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loading = inject(LoadingService);

  // Skip silent background requests such as token refresh
  if (req.url.includes('/auth/refresh')) {
    return next(req);
  }

  loading.startHttp();

  return next(req).pipe(
    finalize(() => {
      loading.endHttp();
    })
  );
};
