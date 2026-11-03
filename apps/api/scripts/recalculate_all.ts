import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SnapshotsService } from '../src/snapshots/snapshots.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const snapshotsService = app.get(SnapshotsService);

  for (let i = 1; i <= 7; i++) {
    console.log(`Recalculating snapshot ${i}...`);
    try {
      await snapshotsService.recalculateSnapshot(i);
      console.log(`Snapshot ${i} recalculated successfully.`);
    } catch (e: any) {
      console.error(`Failed to recalculate snapshot ${i}:`, e.message);
    }
  }

  await app.close();
}

bootstrap().catch(console.error);
