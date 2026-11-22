import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { ConfigService } from './config.service';
import { ConfigSelectors } from './config.selectors';
import { UpsertGlobalConfigDto } from './dto/upsert-global-config.dto';
import { SimulateRulesDto } from './dto/simulate-rules.dto';
import { CreateCustomRequestDto } from './dto/create-custom-request.dto';
import { UpdateCustomRequestDto } from './dto/update-custom-request.dto';
import { getUserIdOrThrow } from '../auth/auth.utils';

@Controller('api/config')
export class ConfigController {
  constructor(
    private readonly configService: ConfigService,
    private readonly configSelectors: ConfigSelectors,
  ) {}

  @Get()
  getConfig(@Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.configSelectors.getConfig(userId);
  }

  @Post()
  upsertConfig(@Body() dto: UpsertGlobalConfigDto, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.configService.upsertConfig(dto, userId);
  }

  @Patch('studio')
  updateStudioConfig(@Body() body: any, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.configService.updateStudioConfig(body, userId);
  }

  @Post('simulate-rules')
  simulateRules(@Body() dto: SimulateRulesDto) {
    return this.configService.simulateModularRules(dto);
  }

  @Post('restore-defaults')
  restoreDefaults(@Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.configService.restoreDefaultRules(userId);
  }

  @Post('sync-to-period')
  syncToPeriod(@Body() body?: { month?: number; year?: number }, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.configService.syncToCurrentPeriod(body?.month, body?.year, userId);
  }

  @Get('backup')
  exportBackup() {
    return this.configSelectors.exportFullBackup();
  }

  @Post('restore')
  restoreBackup(
    @Body()
    body: {
      confirmPhrase?: string;
      backup?: { schemaVersion?: string; data?: Record<string, any[]> };
    },
  ) {
    return this.configService.restoreFullBackup(body);
  }

  // ─────────────────────────────────────────────
  // Custom Feature & Module Requests
  // ─────────────────────────────────────────────

  @Get('custom-requests')
  listCustomRequests() {
    return this.configService.listCustomRequests();
  }

  @Post('custom-requests')
  createCustomRequest(@Body() dto: CreateCustomRequestDto) {
    return this.configService.createCustomRequest(dto);
  }

  @Patch('custom-requests/:id')
  updateCustomRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCustomRequestDto,
  ) {
    return this.configService.updateCustomRequest(id, dto);
  }

  @Delete('custom-requests/:id')
  deleteCustomRequest(@Param('id', ParseIntPipe) id: number) {
    return this.configService.deleteCustomRequest(id);
  }

  // ─────────────────────────────────────────────
  // Sandbox & Dynamic Routine Categories
  // ─────────────────────────────────────────────

  @Post('reset-sandbox')
  resetSandbox(@Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.configService.resetSandbox(userId);
  }

  @Get('routine-categories')
  getRoutineCategories(@Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.configService.getRoutineCategories(userId);
  }

  @Post('routine-categories')
  addRoutineCategory(
    @Body() body: { label: string; target: number },
    @Req() req?: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.configService.addRoutineCategory(body.label, body.target, userId);
  }

  @Delete('routine-categories/:id')
  removeRoutineCategory(@Param('id') id: string, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.configService.removeRoutineCategory(id, userId);
  }
}
