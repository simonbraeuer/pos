/** Device type in the POS system */
export type DeviceType = 'TABLET' | 'EFT' | 'CASH_DRAWER' | 'PRINTER';

/** A physical device that may be attached to a hardware station */
export interface Device {
  id: number;
  code: string;
  name: string;
  type: DeviceType;
  /** Optional link to a hardware station */
  hwStationId?: number;
  /** When true, the device is managed by the remote-device-service */
  managedByRemoteDeviceService?: boolean;
  /** Online status — only meaningful when managedByRemoteDeviceService is true */
  isOnline?: boolean;
  href?: string;
  '@type'?: string;
}

export interface CreateDeviceRequest {
  code: string;
  name: string;
  type: DeviceType;
  hwStationId?: number;
  managedByRemoteDeviceService?: boolean;
}

export interface UpdateDeviceRequest {
  code?: string;
  name?: string;
  hwStationId?: number | null;
  managedByRemoteDeviceService?: boolean;
}
