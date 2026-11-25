import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { getUserIdOrThrow } from '../auth/auth.utils';
import { CommitmentsSelectors } from './commitments.selectors';
import { CommitmentsService } from './commitments.service';
import {
  CreateCommitmentDto,
  SetCommitmentStatusDto,
  UpdateCommitmentDto,
} from './dto/commitment.dto';

@Controller('api/commitments')
export class CommitmentsController {
  constructor(
    private readonly selectors: CommitmentsSelectors,
    private readonly service: CommitmentsService,
  ) {}

  @Get()
  list(
    @Query('month') monthStr?: string,
    @Query('year') yearStr?: string,
    @Req() req?: any,
  ) {
    const userId = getUserIdOrThrow(req);
    const month = monthStr ? parseInt(monthStr, 10) : undefined;
    const year = yearStr ? parseInt(yearStr, 10) : undefined;
    return this.selectors.listForPeriod(userId, month, year);
  }

  @Post()
  create(@Body() dto: CreateCommitmentDto, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.service.create(dto, userId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCommitmentDto,
    @Req() req?: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.service.update(id, dto, userId);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetCommitmentStatusDto,
    @Req() req?: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.service.setStatus(id, dto.status, userId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.service.remove(id, userId);
  }
}
