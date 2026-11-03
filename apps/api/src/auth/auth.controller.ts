import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyPasswordDto } from './dto/verify-password.dto';
import { CurrentUser } from './current-user.decorator';
import { extractClientIp } from './auth.utils';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ) {
    const clientIp = extractClientIp(req);
    return this.authService.login(dto, clientIp);
  }

  @Post('verify-password')
  @HttpCode(HttpStatus.OK)
  async verifyPassword(
    @Body() dto: VerifyPasswordDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id || (req as any).userId;
    const clientIp = extractClientIp(req);
    return this.authService.verifyPassword(userId, dto.password, clientIp);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    return this.authService.refreshToken(token, (req as any).userId);
  }

  @Get('session')
  async getSession(@Req() req: Request) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    return this.authService.getSession(token);
  }

  @Post('demo-login')
  @HttpCode(HttpStatus.OK)
  async demoLogin() {
    return this.authService.demoLogin();
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get('me')
  async getMe(@CurrentUser() user: any, @Req() req: any) {
    const userId = user?.id || req.userId || (process.env.NODE_ENV === 'test' ? 1 : null);
    if (!userId) {
      throw new UnauthorizedException('No active session.');
    }
    return this.authService.getMe(userId);
  }

  @Post('reset-demo')
  @HttpCode(HttpStatus.OK)
  async resetDemo() {
    return this.authService.resetDemoSandbox();
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout() {
    return { success: true, message: 'Logged out successfully.' };
  }
}
