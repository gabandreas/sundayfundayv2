import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CreditService } from '../src/credit/credit.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const creditService = app.get(CreditService);

  console.log("Syncing liabilities for Oct 2026...");
  try {
    const result = await creditService.syncLiabilitiesToSnapshot(10, 2026);
    console.log("Sync Result:", result);
  } catch (e: any) {
    console.error("Failed:", e.message);
  }

  await app.close();
}

bootstrap().catch(console.error);
