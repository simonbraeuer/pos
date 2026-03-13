import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ApiBehaviourConfigComponent, ApiBehaviourConfig } from './api-behaviour-config.component';
import { ProcessContentLayoutComponent } from '@pos/core-ui';

@Component({
	selector: 'pos-process-configure-demo',
	standalone: true,
	imports: [ApiBehaviourConfigComponent, ProcessContentLayoutComponent],
	templateUrl: './pos-process-configure-demo.component.html',
	styleUrls: ['./pos-process-configure-demo.component.scss']
})
export class PosProcessConfigureDemoComponent {
	maintenanceError: string | null = null;
	maintenanceBusy: 'db' | 'storage' | null = null;
	apiBehaviour = { latency: 0, errorRate: 0, failureStatus: 503 };

	constructor(private router: Router) {}

	onAbort() {
		this.router.navigate(['pos/']);
	}

	onApiBehaviourChange(val: any) {
		this.apiBehaviour = val;
	}

	resetIndexedDb() {
		this.maintenanceBusy = 'db';
		setTimeout(() => {
			this.maintenanceBusy = null;
			this.maintenanceError = null; // or set error if needed
		}, 1200);
	}

	clearLocalStorageRecords() {
		this.maintenanceBusy = 'storage';
		setTimeout(() => {
			this.maintenanceBusy = null;
			this.maintenanceError = null; // or set error if needed
		}, 1200);
	}
}
