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
import { EmailModule } from './email/email.module';
import { AuthMiddleware } from './auth/auth.middleware';
import { CalculatorModule } from './calculator/calculator.module';
import { MarqueeModule } from './marquee/marquee.module';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { CommitmentsModule } from './commitments/commitments.module';
import { EventsModule } from './events/events.module';
import { SinkingFundsModule } from './sinking-funds/sinking-funds.module';

@Module({
  imports: [
    PrismaModule,
    IdempotencyModule,
    CalculatorModule,
    SnapshotsModule,
    CreditModule,
    FinanceModule,
    SavingsModule,
    ConfigModule,
    BillsModule,
    CommitmentsModule,
    EventsModule,
    SinkingFundsModule,
    AuditModule,
    WishlistModule,
    AnalyticsModule,
    ReportsModule,
    AuthModule,
    AdminModule,
    EmailModule,
    MarqueeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('*');
  }
}

