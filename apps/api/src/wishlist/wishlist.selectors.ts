import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WishlistItem, WishlistStatus } from '@prisma/client';

@Injectable()
export class WishlistSelectors {
  constructor(private readonly prisma: PrismaService) {}

  async listItems(status?: WishlistStatus, userId: number = 1): Promise<WishlistItem[]> {
    return this.prisma.wishlistItem.findMany({
      where: {
        userId,
        ...(status !== undefined ? { status } : {}),
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async getItemById(id: number, userId?: number): Promise<WishlistItem | null> {
    const item = await this.prisma.wishlistItem.findUnique({ where: { id } });
    if (item && userId !== undefined && item.userId !== userId) {
      throw new ForbiddenException('Access denied to wishlist item');
    }
    return item;
  }
}
