import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SqlStudioService } from './sql-studio.service';
import { ExecuteQueryDto, TableRecordQueryDto } from './sql-studio.dto';
import { PlatformOwnerGuard } from '../../auth/roles.guard';

@Controller('api/admin/sql')
@UseGuards(PlatformOwnerGuard)
export class SqlStudioController {
  constructor(private readonly sqlStudioService: SqlStudioService) {}

  @Get('tables')
  async getTables() {
    return this.sqlStudioService.getTablesWithMetadata();
  }

  @Post('query')
  @HttpCode(HttpStatus.OK)
  async executeQuery(@Body() dto: ExecuteQueryDto) {
    return this.sqlStudioService.executeQuery(dto);
  }

  @Get('records/:tableName')
  async getRecords(
    @Param('tableName') tableName: string,
    @Query() query: TableRecordQueryDto,
  ) {
    return this.sqlStudioService.getTableRecords(tableName, query);
  }

  @Post('records/:tableName')
  async createRecord(
    @Param('tableName') tableName: string,
    @Body() data: Record<string, any>,
  ) {
    return this.sqlStudioService.createTableRecord(tableName, data);
  }

  @Patch('records/:tableName/:id')
  async updateRecord(
    @Param('tableName') tableName: string,
    @Param('id') id: string,
    @Body() data: Record<string, any>,
  ) {
    return this.sqlStudioService.updateTableRecord(tableName, id, data);
  }

  @Delete('records/:tableName/:id')
  async deleteRecord(
    @Param('tableName') tableName: string,
    @Param('id') id: string,
  ) {
    return this.sqlStudioService.deleteTableRecord(tableName, id);
  }
}
