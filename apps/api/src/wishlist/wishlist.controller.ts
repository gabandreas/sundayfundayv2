import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { WishlistSelectors } from './wishlist.selectors';
import { CreateWishlistItemDto } from './dto/create-wishlist-item.dto';
import { UpdateWishlistItemDto } from './dto/update-wishlist-item.dto';
import { QueryWishlistDto } from './dto/query-wishlist.dto';
import { AnalyzeWishlistDraftDto } from './dto/analyze-wishlist-draft.dto';
import { getUserIdOrThrow } from '../auth/auth.utils';

@Controller('api/wishlist')
export class WishlistController {
  constructor(
    private readonly service: WishlistService,
    private readonly selectors: WishlistSelectors,
  ) {}

  @Get()
  async listItems(@Query() query: QueryWishlistDto, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.selectors.listItems(query.status, userId);
  }

  @Get(':id')
  async getItemById(@Param('id', ParseIntPipe) id: number, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.selectors.getItemById(id, userId);
  }

  @Post()
  async createItem(@Body() dto: CreateWishlistItemDto, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.service.createItem(dto, userId);
  }

  @Patch(':id')
  async updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWishlistItemDto,
    @Req() req?: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.service.updateItem(id, dto, userId);
  }

  @Delete(':id')
  async deleteItem(@Param('id', ParseIntPipe) id: number, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.service.deleteItem(id, userId);
  }

  @Get(':id/analyze')
  async analyzeItem(
    @Param('id', ParseIntPipe) id: number,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Req() req?: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.service.analyzePurchase(
      id,
      month ? parseInt(month, 10) : undefined,
      year ? parseInt(year, 10) : undefined,
      userId,
    );
  }

  @Post('analyze-draft')
  async analyzeDraft(
    @Body() dto: AnalyzeWishlistDraftDto,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Req() req?: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.service.analyzePurchase(
      dto,
      month ? parseInt(month, 10) : undefined,
      year ? parseInt(year, 10) : undefined,
      userId,
    );
  }

  @Post(':id/convert-to-contract')
  async convertToContract(@Param('id', ParseIntPipe) id: number, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.service.convertToContract(id, userId);
  }

  @Post(':id/track-as-savings-goal')
  async trackAsSavingsGoal(@Param('id', ParseIntPipe) id: number, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.service.trackAsSavingsGoal(id, userId);
  }
}
