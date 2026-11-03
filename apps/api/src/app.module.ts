import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { SnapshotsModule } from './snapshots/snapshots.module';
import { CreditModule } from './credit/credit.module';
import { FinanceModule } from './finance/finance.module';
import { SavingsModule } from './savings/savings.module';
import { ConfigModule } from './config/config.module';
import { BillsModule } from './bills/bills.module';
import { AuditModule } from './audit/audit.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ReportsModule } from './reports/reports.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { AuthMiddleware } from './auth/auth.middleware';

@Module({
  imports: [
    PrismaModule,
    SnapshotsModule,
    CreditModule,
    FinanceModule,
    SavingsModule,
    ConfigModule,
    BillsModule,
    AuditModule,
    WishlistModule,
    AnalyticsModule,
    ReportsModule,
    AuthModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('*');
  }
}

