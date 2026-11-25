export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface JwtPayload {
  sub: string;
  email: string;
}

export interface AuthResult {
  user: AuthenticatedUser;
  accessToken: string;
}
