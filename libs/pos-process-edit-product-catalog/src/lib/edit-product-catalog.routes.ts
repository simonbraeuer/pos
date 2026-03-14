import { Routes } from '@angular/router';
import { EditProductCatalogComponent } from './edit-product-catalog.component';
import { ProductCatalogFormComponent } from './product-catalog-form.component';
import { ProductOfferingResolver } from './product-offering.resolver';

export const EDIT_PRODUCT_CATALOG_ROUTES: Routes = [
  {
    path: '',
    component: EditProductCatalogComponent,
    children: [
      {
        path: 'create-product',
        component: ProductCatalogFormComponent,
        data: { mode: 'create' },
      },
      {
        path: 'edit-product/:productId',
        component: ProductCatalogFormComponent,
        data: { mode: 'edit' },
        resolve: { product: ProductOfferingResolver },
      },
    ],
  },
];
