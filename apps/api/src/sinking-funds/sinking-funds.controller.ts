import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { getUserIdOrThrow } from '../auth/auth.utils';
import { SinkingFundsSelectors } from './sinking-funds.selectors';
import { SinkingFundsService } from './sinking-funds.service';
import {
  ContributeSinkingFundDto,
  CreateSinkingFundDto,
  UpdateSinkingFundDto,
} from './dto/sinking-fund.dto';

@Controller('sinking-funds')
export class SinkingFundsController {
  constructor(
    private readonly selectors: SinkingFundsSelectors,
    private readonly service: SinkingFundsService,
  ) {}

  @Get()
  list(@Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.selectors.list(userId);
  }

  @Post()
  create(@Body() dto: CreateSinkingFundDto, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.service.create(dto, userId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSinkingFundDto,
    @Req() req?: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.service.update(id, dto, userId);
  }

  @Post(':id/contribute')
  contribute(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ContributeSinkingFundDto,
    @Req() req?: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.service.contribute(id, dto.amountRp, userId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.service.remove(id, userId);
  }
}
