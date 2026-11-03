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
} from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { WishlistSelectors } from './wishlist.selectors';
import { CreateWishlistItemDto } from './dto/create-wishlist-item.dto';
import { UpdateWishlistItemDto } from './dto/update-wishlist-item.dto';
import { QueryWishlistDto } from './dto/query-wishlist.dto';
import { AnalyzeWishlistDraftDto } from './dto/analyze-wishlist-draft.dto';

@Controller('api/wishlist')
export class WishlistController {
  constructor(
    private readonly service: WishlistService,
    private readonly selectors: WishlistSelectors,
  ) {}

  @Get()
  async listItems(@Query() query: QueryWishlistDto) {
    return this.selectors.listItems(query.status);
  }

  @Get(':id')
  async getItemById(@Param('id', ParseIntPipe) id: number) {
    return this.selectors.getItemById(id);
  }

  @Post()
  async createItem(@Body() dto: CreateWishlistItemDto) {
    return this.service.createItem(dto);
  }

  @Patch(':id')
  async updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWishlistItemDto,
  ) {
    return this.service.updateItem(id, dto);
  }

  @Delete(':id')
  async deleteItem(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteItem(id);
  }

  @Get(':id/analyze')
  async analyzeItem(
    @Param('id', ParseIntPipe) id: number,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.service.analyzePurchase(
      id,
      month ? parseInt(month, 10) : undefined,
      year ? parseInt(year, 10) : undefined,
    );
  }

  @Post('analyze-draft')
  async analyzeDraft(
    @Body() dto: AnalyzeWishlistDraftDto,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.service.analyzePurchase(
      dto,
      month ? parseInt(month, 10) : undefined,
      year ? parseInt(year, 10) : undefined,
    );
  }

  @Post(':id/convert-to-contract')
  async convertToContract(@Param('id', ParseIntPipe) id: number) {
    return this.service.convertToContract(id);
  }

  @Post(':id/track-as-savings-goal')
  async trackAsSavingsGoal(@Param('id', ParseIntPipe) id: number) {
    return this.service.trackAsSavingsGoal(id);
  }
}
