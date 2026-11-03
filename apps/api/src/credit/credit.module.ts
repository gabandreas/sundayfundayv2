import { Module, forwardRef } from '@nestjs/common';
import { CreditController } from './credit.controller';
import { CreditService } from './credit.service';
import { CreditSelectors } from './credit.selectors';
import { PrismaModule } from '../prisma/prisma.module';
import { SnapshotsModule } from '../snapshots/snapshots.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, forwardRef(() => SnapshotsModule), AuditModule],
  controllers: [CreditController],
  providers: [CreditService, CreditSelectors],
  exports: [CreditService, CreditSelectors],
})
export class CreditModule {}
