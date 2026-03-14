import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Tmf620ApiService, ProductOffering } from '@pos/tmf620';

@Injectable({ providedIn: 'root' })
export class ProductOfferingResolver implements Resolve<ProductOffering | null> {
  constructor(private api: Tmf620ApiService) {}

  resolve(route: ActivatedRouteSnapshot): Observable<ProductOffering | null> {
    const productId = route.paramMap.get('productId');
    if (!productId) return of(null);
    return this.api.getProductOffering(productId).pipe(
      catchError(() => of(null))
    );
  }
}
