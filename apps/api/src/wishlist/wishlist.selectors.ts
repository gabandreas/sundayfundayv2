import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WishlistItem, WishlistStatus } from '@prisma/client';

@Injectable()
export class WishlistSelectors {
  constructor(private readonly prisma: PrismaService) {}

  async listItems(status?: WishlistStatus): Promise<WishlistItem[]> {
    return this.prisma.wishlistItem.findMany({
      where: status !== undefined ? { status } : undefined,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async getItemById(id: number): Promise<WishlistItem | null> {
    return this.prisma.wishlistItem.findUnique({ where: { id } });
  }
}
