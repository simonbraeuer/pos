import { InjectionToken } from '@angular/core';

export interface ShopMaintenanceMenuApi {
	getApiBehaviour(): { latency: number; errorRate: number; failureStatus: number };
	setApiBehaviour(config: { latency: number; errorRate: number; failureStatus: number }): void;
	resetIndexedDb(): Promise<void>;
	clearLocalStorageRecords(): Promise<void>;
	getMaintenanceError(): string | null;
	getMaintenanceBusy(): 'db' | 'storage' | null;
}

export const SHOP_MAINTENANCE_MENU_API = new InjectionToken<ShopMaintenanceMenuApi>('ShopMaintenanceMenuApi');
