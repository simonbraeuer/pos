export interface Register {
  id: number;
  code: string;
  name: string;
  hwStationId?: number;
  href?: string;
  '@type'?: string;
}

export interface CreateRegisterRequest {
  code: string;
  name: string;
  hwStationId?: number;
}

export interface UpdateRegisterRequest {
  code?: string;
  name?: string;
  hwStationId?: number;
}
