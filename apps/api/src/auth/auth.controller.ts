import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { PlatformOwnerGuard } from './roles.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyPasswordDto } from './dto/verify-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CompleteFirstLoginPasswordDto } from './dto/complete-first-login-password.dto';
import {
  RefreshTokenDto,
  LogoutDto,
  SetupPinDto,
  VerifyPinDto,
  EnrollBiometricDto,
  BiometricChallengeDto,
  VerifyBiometricDto,
  SsoExchangeDto,
} from './dto/mobile-auth.dto';
import { CurrentUser } from './current-user.decorator';
import { extractClientIp, getUserIdOrThrow } from './auth.utils';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const clientIp = extractClientIp(req);
    return this.authService.login(dto, clientIp);
  }

  @Post('verify-password')
  @HttpCode(HttpStatus.OK)
  async verifyPassword(@Body() dto: VerifyPasswordDto, @Req() req: Request) {
    const userId = getUserIdOrThrow(req);
    const clientIp = extractClientIp(req);
    return this.authService.verifyPassword(userId, dto.password, clientIp);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    const clientIp = extractClientIp(req);
    if (dto?.refreshToken) {
      return this.authService.rotateRefreshToken(dto, clientIp);
    }
    const authHeader = req.headers['authorization'];
    const token =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : null;
    return this.authService.refreshToken(token, (req as any).userId);
  }

  @Get('session')
  async getSession(@Req() req: Request) {
    const authHeader = req.headers['authorization'];
    const token =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : null;
    return this.authService.getSession(token);
  }

  @Get('sessions')
  async listSessions(@Req() req: any) {
    const userId = getUserIdOrThrow(req);
    return this.authService.listSessions(userId, req.sessionId);
  }

  @Delete('sessions/:sessionId')
  async revokeSession(@Param('sessionId') sessionId: string, @Req() req: any) {
    const userId = getUserIdOrThrow(req);
    return this.authService.revokeSession(userId, sessionId);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@Req() req: any) {
    const userId = getUserIdOrThrow(req);
    return this.authService.logoutAll(userId);
  }

  @Post('pin/setup')
  @HttpCode(HttpStatus.OK)
  async setupPin(@Body() dto: SetupPinDto, @Req() req: any) {
    const userId = getUserIdOrThrow(req);
    const clientIp = extractClientIp(req);
    return this.authService.setupSecurityPin(userId, dto, clientIp);
  }

  @Post('pin/verify')
  @HttpCode(HttpStatus.OK)
  async verifyPin(@Body() dto: VerifyPinDto, @Req() req: any) {
    const clientIp = extractClientIp(req);
    const userId = req?.isAuthenticated ? req.userId : undefined;
    return this.authService.verifySecurityPin({ ...dto, userId }, clientIp);
  }

  @Post('biometric/enroll')
  @HttpCode(HttpStatus.OK)
  async enrollBiometric(@Body() dto: EnrollBiometricDto, @Req() req: any) {
    const userId = getUserIdOrThrow(req);
    return this.authService.enrollBiometricDevice(userId, dto);
  }

  @Delete('biometric/:deviceId')
  async disableBiometric(@Param('deviceId') deviceId: string, @Req() req: any) {
    const userId = getUserIdOrThrow(req);
    return this.authService.disableBiometricDevice(userId, deviceId);
  }

  @Post('biometric/challenge')
  @HttpCode(HttpStatus.OK)
  async createBiometricChallenge(@Body() dto: BiometricChallengeDto) {
    return this.authService.createBiometricChallenge(dto);
  }

  @Post('biometric/verify')
  @HttpCode(HttpStatus.OK)
  async verifyBiometric(@Body() dto: VerifyBiometricDto, @Req() req: any) {
    const clientIp = extractClientIp(req);
    return this.authService.verifyBiometricChallenge(dto, clientIp);
  }

  @Get('sso/providers')
  listSsoProviders() {
    return { providers: this.authService.listSsoProviders() };
  }

  @Post('sso/exchange')
  @HttpCode(HttpStatus.OK)
  async exchangeSso(@Body() dto: SsoExchangeDto, @Req() req: any) {
    const clientIp = extractClientIp(req);
    return this.authService.loginWithSso(dto, clientIp);
  }

  @Post('sso/link')
  @HttpCode(HttpStatus.OK)
  async linkSso(@Body() dto: SsoExchangeDto, @Req() req: any) {
    const userId = getUserIdOrThrow(req);
    return this.authService.linkSsoIdentity(userId, dto);
  }

  @Delete('sso/:id')
  async unlinkSso(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userId = getUserIdOrThrow(req);
    return this.authService.unlinkSsoIdentity(userId, id);
  }

  @Post('demo-login')
  @HttpCode(HttpStatus.OK)
  async demoLogin() {
    return this.authService.demoLogin();
  }

  @Post('register')
  @UseGuards(PlatformOwnerGuard)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get('me')
  async getMe(@CurrentUser() _user: any, @Req() req: any) {
    const userId = getUserIdOrThrow(req);
    return this.authService.getMe(userId);
  }

  @Patch('profile')
  async updateProfile(@Body() dto: UpdateProfileDto, @Req() req: any) {
    const userId = getUserIdOrThrow(req);
    return this.authService.updateProfile(userId, dto);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: any) {
    const userId = getUserIdOrThrow(req);
    const clientIp = extractClientIp(req);
    return this.authService.changePassword(userId, dto, clientIp);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    const clientIp = extractClientIp(req);
    return this.authService.forgotPassword(dto, clientIp);
  }

  @Get('reset-password/validate')
  async validateResetToken(@Query('token') token: string) {
    return this.authService.validatePasswordResetToken(token);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    const clientIp = extractClientIp(req);
    return this.authService.resetPasswordWithToken(dto, clientIp);
  }

  @Post('complete-first-login-password')
  @HttpCode(HttpStatus.OK)
  async completeFirstLoginPassword(
    @Body() dto: CompleteFirstLoginPasswordDto,
    @Req() req: any,
  ) {
    const userId = getUserIdOrThrow(req);
    const clientIp = extractClientIp(req);
    return this.authService.completeFirstLoginPassword(userId, dto, clientIp);
  }

  @Post('reset-demo')
  @HttpCode(HttpStatus.OK)
  async resetDemo() {
    return this.authService.resetDemoSandbox();
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: LogoutDto, @Req() req: any) {
    return this.authService.logoutSession({
      userId: req?.userId,
      sessionId: req?.sessionId,
      refreshToken: dto?.refreshToken,
    });
  }
}
