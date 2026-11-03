import { Module } from '@nestjs/common';
import { SqlStudioController } from './sql-studio.controller';
import { SqlStudioService } from './sql-studio.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SqlStudioController],
  providers: [SqlStudioService],
  exports: [SqlStudioService],
})
export class SqlStudioModule {}
