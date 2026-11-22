import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { EmailService } from './email.service';
import { getUserIdOrThrow } from '../auth/auth.utils';
import {
  SendDigestOrBackupEmailDto,
  SendMonthlyStatementEmailDto,
  SendTestEmailDto,
} from './dto/email-dispatch.dto';
import { PreviewEmailTemplateDto } from './dto/preview-email.dto';

@Controller('api/email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Get('status')
  async getStatus(@Req() req: any) {
    const userId = getUserIdOrThrow(req);
    return this.emailService.getStatus(userId);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyConnection(@Req() req: any) {
    const userId = getUserIdOrThrow(req);
    return this.emailService.verifyConnection(userId);
  }

  @Post('monthly-statement')
  @HttpCode(HttpStatus.OK)
  async sendMonthlyStatement(
    @Body() dto: SendMonthlyStatementEmailDto,
    @Req() req: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.emailService.sendMonthlyStatement({
      userId,
      month: dto.month,
      year: dto.year,
      scope: dto.scope,
      locale: dto.locale,
      recipientEmail: dto.recipientEmail,
      dryRun: dto.dryRun,
    });
  }

  @Post('cutoff-digest')
  @HttpCode(HttpStatus.OK)
  async sendCutoffDigest(
    @Body() dto: SendDigestOrBackupEmailDto,
    @Req() req: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.emailService.sendCutoffDigest({
      userId,
      month: dto.month,
      year: dto.year,
      locale: dto.locale,
      recipientEmail: dto.recipientEmail,
      dryRun: dto.dryRun,
    });
  }

  @Post('ledger-backup')
  @HttpCode(HttpStatus.OK)
  async sendLedgerBackup(
    @Body() dto: SendDigestOrBackupEmailDto,
    @Req() req: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.emailService.sendOffsiteBackup({
      userId,
      month: dto.month,
      year: dto.year,
      locale: dto.locale,
      recipientEmail: dto.recipientEmail,
      dryRun: dto.dryRun,
    });
  }

  @Post('test-dispatch')
  @HttpCode(HttpStatus.OK)
  async sendTestDispatch(
    @Body() dto: SendTestEmailDto,
    @Req() req: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.emailService.sendTestEmail({
      userId,
      locale: dto.locale,
      recipientEmail: dto.recipientEmail,
      dryRun: dto.dryRun,
    });
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  async previewTemplate(
    @Body() dto: PreviewEmailTemplateDto,
    @Req() req: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.emailService.previewTemplate({
      userId,
      template: dto.template,
      month: dto.month,
      year: dto.year,
      scope: dto.scope,
      locale: dto.locale,
      recipientEmail: dto.recipientEmail,
      killSwitchId: dto.killSwitchId,
    });
  }
}
