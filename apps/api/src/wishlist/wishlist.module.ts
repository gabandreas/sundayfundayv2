import { Module } from '@nestjs/common';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';
import { WishlistSelectors } from './wishlist.selectors';
import { AuditModule } from '../audit/audit.module';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [AuditModule, ConfigModule],
  controllers: [WishlistController],
  providers: [WishlistService, WishlistSelectors],
  exports: [WishlistService, WishlistSelectors],
})
export class WishlistModule {}
