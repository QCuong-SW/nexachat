import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import type { AuthenticatedUser, JwtPayload } from '../types/auth.types';

function extractJwtFromCookie(cookieName: string) {
  return (req: Request): string | null => {
    const cookies = req?.cookies as Record<string, unknown> | undefined;
    const token = cookies?.[cookieName];
    return typeof token === 'string' && token.length > 0 ? token : null;
  };
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const cookieName = configService.get<string>('auth.cookieName') ?? 'nexa_session';
    const jwtSecret = configService.get<string>('auth.jwtSecret');

    if (!jwtSecret) {
      throw new Error('JWT_SECRET must be configured.');
    }

    super({
      jwtFromRequest: extractJwtFromCookie(cookieName),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload?.sub) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid authentication session.',
      });
    }

    return this.authService.getAuthenticatedUser(payload.sub);
  }
}
