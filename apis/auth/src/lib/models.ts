export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'user';
  email: string;
  displayName: string;
}

export type PublicUser = Omit<User, 'passwordHash'>;

export interface Session {
  token: string;
  userId: string;
  username: string;
  role: 'admin' | 'user';
  displayName: string;
  expiresAt: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: PublicUser;
}
