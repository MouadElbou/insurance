import type { Role } from "./employee.types.js";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    full_name: string;
    role: Role;
    operator_code: string;
  };
  access_token: string;
  refresh_token: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

export interface TokenPayload {
  sub: string;
  email: string;
  role: Role;
  iat: number;
  exp: number;
}
