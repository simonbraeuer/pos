export type ShiftStatus = 'OPEN' | 'NEED_CLOSURE' | 'CLOSED';

export interface Shift {
  id: number;
  registerId: number;
  userId: string;
  bookingDay: string;
  status: ShiftStatus;
  openedAt: string;
  closedAt?: string;
  href?: string;
  '@type'?: string;
}

export interface OpenShiftRequest {
  registerId: number;
  userId: string;
  bookingDay?: string;
}
