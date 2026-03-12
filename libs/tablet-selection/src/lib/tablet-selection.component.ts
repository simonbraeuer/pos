import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DeviceApiService, Device } from '@pos/device';
import { HardwareStationApiService, HardwareStation } from '@pos/hardware-station';
import { LocationApiService, Location } from '@pos/location';
import { RegisterApiService, Register } from '@pos/register';
import {
  TabletSelectionRecord,
  TabletSelectionStateService,
} from './tablet-selection-state.service';

interface TabletNode {
  device: Device;
  hardwareStation?: HardwareStation;
  register?: Register;
}

interface LocationTabletTreeNode {
  location: Location;
  tablets: TabletNode[];
}

@Component({
  selector: 'lib-tablet-selection',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tablet-selection.component.html',
  styleUrl: './tablet-selection.component.scss',
})
export class TabletSelectionComponent implements OnInit {
  private readonly locationApi = inject(LocationApiService);
  private readonly hardwareStationApi = inject(HardwareStationApiService);
  private readonly deviceApi = inject(DeviceApiService);
  private readonly registerApi = inject(RegisterApiService);
  private readonly selectionState = inject(TabletSelectionStateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly selectingDeviceId = signal<number | null>(null);
  readonly error = signal<string | null>(null);
  readonly filter = signal('');
  readonly tree = signal<LocationTabletTreeNode[]>([]);

  readonly currentSelection = this.selectionState.selectedTablet;

  readonly filteredTree = computed(() => {
    const query = this.filter().trim().toLowerCase();
    const nodes = this.tree();
    if (!query) return nodes;

    return nodes
      .map((node) => {
        const locationMatch = this.matchesLocation(node.location, query);
        const tablets = node.tablets.filter((tabletNode) =>
          this.matchesTablet(tabletNode, query) || locationMatch
        );
        return { ...node, tablets };
      })
      .filter((node) => node.tablets.length > 0);
  });

  ngOnInit(): void {
    this.load();
  }

  clearSelection(): void {
    this.selectionState.clearSelection();
  }

  isSelected(deviceId: number): boolean {
    return this.currentSelection()?.deviceId === deviceId;
  }

  selectTablet(location: Location, node: TabletNode): void {
    this.selectingDeviceId.set(node.device.id);

    const selectionRecord: TabletSelectionRecord = {
      deviceId: node.device.id,
      deviceCode: node.device.code,
      deviceName: node.device.name,
      hwStationId: node.hardwareStation?.id,
      locationId: location.id,
      locationName: location.name,
      selectedAt: new Date().toISOString(),
    };

    this.selectionState.selectTablet(selectionRecord).subscribe({
      next: () => {
        this.selectingDeviceId.set(null);
        const redirect = this.route.snapshot.queryParamMap.get('redirect') || '/';
        this.router.navigateByUrl(redirect);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to save tablet selection.');
        this.selectingDeviceId.set(null);
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      locations: this.locationApi.listLocations().pipe(catchError(() => of([] as Location[]))),
      hardwareStations: this.hardwareStationApi
        .listHardwareStations()
        .pipe(catchError(() => of([] as HardwareStation[]))),
      devices: this.deviceApi
        .listDevices({ type: 'TABLET' })
        .pipe(catchError(() => of([] as Device[]))),
      registers: this.registerApi.listRegisters().pipe(catchError(() => of([] as Register[]))),
    }).subscribe({
      next: ({ locations, hardwareStations, devices, registers }) => {
        this.tree.set(this.buildTree(locations, hardwareStations, devices, registers));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load tablet selection data.');
        this.loading.set(false);
      },
    });
  }

  private buildTree(
    locations: Location[],
    hardwareStations: HardwareStation[],
    devices: Device[],
    registers: Register[]
  ): LocationTabletTreeNode[] {
    const stationById = new Map(hardwareStations.map((s) => [s.id, s]));
    const registerByStationId = new Map<number, Register>();
    for (const register of registers) {
      if (register.hwStationId !== undefined && !registerByStationId.has(register.hwStationId)) {
        registerByStationId.set(register.hwStationId, register);
      }
    }

    const tabletsByLocation = new Map<number, TabletNode[]>();

    for (const device of devices) {
      const station = device.hwStationId ? stationById.get(device.hwStationId) : undefined;
      if (!station) {
        continue;
      }

      const node: TabletNode = {
        device,
        hardwareStation: station,
        register: registerByStationId.get(station.id),
      };

      const list = tabletsByLocation.get(station.locationId) ?? [];
      list.push(node);
      tabletsByLocation.set(station.locationId, list);
    }

    return locations
      .map((location) => ({
        location,
        tablets: (tabletsByLocation.get(location.id) ?? []).sort((a, b) =>
          a.device.name.localeCompare(b.device.name)
        ),
      }))
      .filter((node) => node.tablets.length > 0)
      .sort((a, b) => a.location.name.localeCompare(b.location.name));
  }

  private matchesLocation(location: Location, query: string): boolean {
    return (
      location.name.toLowerCase().includes(query) ||
      location.code.toLowerCase().includes(query)
    );
  }

  private matchesTablet(node: TabletNode, query: string): boolean {
    return (
      node.device.name.toLowerCase().includes(query) ||
      node.device.code.toLowerCase().includes(query)
    );
  }
}
