import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AdminService } from './admin.service';
import { PlatformOwnerGuard } from '../auth/roles.guard';
import { extractClientIp, getUserIdOrThrow } from '../auth/auth.utils';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UpdateFeatureRequestDto } from './dto/update-feature-request.dto';
import {
  AddTrustedIpDto,
  UpdateSecuritySettingsDto,
  UpdateOwnerCredentialsDto,
} from './dto/security.dto';
import { RestoreBackupDto } from './dto/restore-backup.dto';

@Controller('api/admin')
@UseGuards(PlatformOwnerGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async getUsers() {
    return this.adminService.getUsers();
  }

  @Post('users')
  async createClient(@Body() dto: CreateClientDto) {
    return this.adminService.createClient(dto);
  }

  @Post('clients')
  async createClientAlias(@Body() dto: CreateClientDto) {
    return this.adminService.createClient(dto);
  }

  @Patch('users/:id')
  async updateClient(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClientDto,
  ) {
    return this.adminService.updateClient(id, dto);
  }

  @Patch('clients/:id')
  async updateClientAlias(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClientDto,
  ) {
    return this.adminService.updateClient(id, dto);
  }

  @Get('users/:id/config')
  async getUserConfig(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getUserConfig(id);
  }

  @Put('users/:id/config')
  @Patch('users/:id/config')
  async updateUserConfig(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: any,
  ) {
    return this.adminService.updateUserConfig(id, updateDto);
  }

  @Get('feature-requests')
  async getFeatureRequests() {
    return this.adminService.getFeatureRequests();
  }

  @Patch('feature-requests/:id')
  async updateFeatureRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFeatureRequestDto,
  ) {
    return this.adminService.updateFeatureRequest(id, dto);
  }

  @Get('security/settings')
  async getSecuritySettings(@Req() req: Request) {
    const clientIp = extractClientIp(req);
    return this.adminService.getSecuritySettings(clientIp);
  }

  @Get('security/ip-whitelist')
  async getSecurityIpWhitelist(@Req() req: Request) {
    const clientIp = extractClientIp(req);
    return this.adminService.getSecuritySettings(clientIp);
  }

  @Post('security/trusted-ips')
  async addTrustedIp(@Body() dto: AddTrustedIpDto) {
    return this.adminService.addTrustedIp(dto);
  }

  @Post('security/ip-whitelist')
  async addIpWhitelist(@Body() dto: AddTrustedIpDto) {
    return this.adminService.addTrustedIp(dto);
  }

  @Delete('security/trusted-ips/:id')
  async removeTrustedIp(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.removeTrustedIp(id);
  }

  @Delete('security/ip-whitelist/:id')
  async removeIpWhitelist(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.removeTrustedIp(id);
  }

  @Post('security/settings')
  async updateSecuritySettings(@Body() dto: UpdateSecuritySettingsDto) {
    return this.adminService.updateSecuritySettings(dto);
  }

  @Patch('security/settings')
  async patchSecuritySettings(@Body() dto: UpdateSecuritySettingsDto) {
    return this.adminService.updateSecuritySettings(dto);
  }

  @Post('security/credentials')
  @HttpCode(HttpStatus.OK)
  async updateCredentials(@Body() dto: UpdateOwnerCredentialsDto) {
    return this.adminService.updateOwnerCredentials(dto);
  }

  @Get('backup/export')
  async exportBackup(@Res() res: Response) {
    const backupData = await this.adminService.exportFullBackup();
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `sunday-funday-erp-backup-${dateStr}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.json(backupData);
  }

  @Post('backup/restore')
  @HttpCode(HttpStatus.OK)
  async restoreBackup(@Body() dto: RestoreBackupDto, @Req() req: any) {
    const userId = getUserIdOrThrow(req);
    return this.adminService.restoreFullBackup(dto, userId);
  }
}
