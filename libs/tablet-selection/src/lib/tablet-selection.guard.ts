import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { TabletSelectionStateService } from './tablet-selection-state.service';

function shouldBypass(url: string): boolean {
  return url.startsWith('/tablet-selection') || url.startsWith('/login');
}

function guardImpl(targetUrl: string) {
  const router = inject(Router);
  const state = inject(TabletSelectionStateService);

  if (shouldBypass(targetUrl)) {
    return of(true);
  }

  return state.ensureVerifiedOnce().pipe(
    map((valid) => {
      if (valid) return true;
      return router.createUrlTree(['/tablet-selection'], {
        queryParams: { redirect: targetUrl },
      });
    }),
    catchError(() =>
      of(
        router.createUrlTree(['/tablet-selection'], {
          queryParams: { redirect: targetUrl },
        })
      )
    )
  );
}

export const tabletSelectionGuard: CanActivateFn = (_, state) => guardImpl(state.url);

export const tabletSelectionChildGuard: CanActivateChildFn = (_, state) =>
  guardImpl(state.url);
