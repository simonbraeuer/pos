export interface HardwareStation {
  id: number;
  code: string;
  name: string;
  locationId: number;
  href?: string;
  '@type'?: string;
}

export interface CreateHardwareStationRequest {
  code: string;
  name: string;
  locationId: number;
}

export interface UpdateHardwareStationRequest {
  code?: string;
  name?: string;
  locationId?: number;
}
