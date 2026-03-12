export interface Location {
  id: number;
  code: string;
  name: string;
  fullName?: string;
  address?: {
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };
  href?: string;
  '@type'?: string;
}

export interface CreateLocationRequest {
  code: string;
  name: string;
  fullName?: string;
  address?: {
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };
}

export interface UpdateLocationRequest {
  code?: string;
  name?: string;
  fullName?: string;
  address?: {
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };
}
