import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './types/auth.types';

@Controller('auth')
export class AuthController {
  private readonly cookieName: string;
  private readonly isProduction: boolean;
  private readonly cookieMaxAgeMs: number;

  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    this.cookieName =
      configService.get<string>('auth.cookieName') ?? 'nexa_session';
    this.isProduction = configService.get<boolean>('isProduction') ?? false;
    this.cookieMaxAgeMs =
      configService.get<number>('auth.cookieMaxAgeMs') ??
      7 * 24 * 60 * 60 * 1000;
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken } = await this.authService.register(dto);
    this.setSessionCookie(res, accessToken);
    return { user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken } = await this.authService.login(dto);
    this.setSessionCookie(res, accessToken);
    return { user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.cookieName, this.buildBaseCookieOptions());
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

  private buildBaseCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProduction,
      path: '/',
    };
  }

  private setSessionCookie(res: Response, token: string): void {
    res.cookie(this.cookieName, token, {
      ...this.buildBaseCookieOptions(),
      maxAge: this.cookieMaxAgeMs,
    });
  }
}
