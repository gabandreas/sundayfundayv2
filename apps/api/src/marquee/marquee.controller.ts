import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { getUserIdOrThrow } from '../auth/auth.utils';
import { MarqueeService } from './marquee.service';
import type { MarqueeChatRequestDto } from './marquee.service';
import type { MarqueeAiProvider } from './marquee-llm.service';

@Controller('api/marquee')
export class MarqueeController {
  constructor(private readonly marqueeService: MarqueeService) {}

  @Post('chat')
  async chat(@Body() dto: MarqueeChatRequestDto, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    if (!dto?.message && !dto?.pendingAction) {
      throw new BadRequestException('Message or pendingAction is required.');
    }
    return this.marqueeService.chat(userId, dto);
  }

  @Post('chat/stream')
  async chatStream(
    @Body() dto: MarqueeChatRequestDto,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const userId = getUserIdOrThrow(req);
    if (!dto?.message && !dto?.pendingAction) {
      throw new BadRequestException('Message or pendingAction is required.');
    }

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    try {
      const result = await this.marqueeService.chatWithProgress(
        userId,
        dto,
        (event) => {
          res.write(`${JSON.stringify(event)}\n`);
        },
      );
      res.write(`${JSON.stringify({ type: 'final', data: result })}\n`);
    } catch (err: any) {
      res.write(
        `${JSON.stringify({
          type: 'error',
          message: err?.message || 'Marquee request failed.',
        })}\n`,
      );
    } finally {
      res.end();
    }
  }

  @Get('config')
  async getConfig(@Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.marqueeService.getConfig(userId);
  }

  @Put('config')
  async updateConfig(
    @Body()
    dto: {
      provider?: MarqueeAiProvider;
      geminiApiKey?: string | null;
      groqApiKey?: string | null;
      deepseekApiKey?: string | null;
      deepseekModel?: 'deepseek-chat' | 'deepseek-flash' | 'deepseek-reasoner';
      opencodeApiKey?: string | null;
      opencodeBaseUrl?: string | null;
      opencodeModel?: string | null;
      webhookEnabled?: boolean;
    },
    @Req() req?: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.marqueeService.updateConfig(userId, dto ?? {});
  }

  @Post('webhook-token/rotate')
  async rotateWebhookToken(@Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.marqueeService.rotateWebhookToken(userId);
  }

  /**
   * Public quick-capture webhook authenticated strictly by X-Marquee-Token header.
   * Ignores JWT / x-user-id so headless shortcuts safely map strictly to the token owner.
   */
  @Post('webhook')
  async handleWebhook(
    @Headers('x-marquee-token') tokenHeader: string | undefined,
    @Body()
    dto: {
      message?: string;
      text?: string;
      autoConfirm?: boolean;
      month?: number;
      year?: number;
    },
  ) {
    const userId = await this.marqueeService.resolveUserIdFromWebhookToken(tokenHeader);
    const rawMsg = String(dto?.message ?? dto?.text ?? '').trim();
    if (!rawMsg) {
      throw new BadRequestException('message or text is required.');
    }
    return this.marqueeService.chat(userId, {
      message: rawMsg,
      confirm: Boolean(dto?.autoConfirm),
      month: dto?.month,
      year: dto?.year,
    });
  }
}
