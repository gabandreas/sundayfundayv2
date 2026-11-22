import { Global, Module } from '@nestjs/common';
import { GoBridgeService } from './go-bridge.service';

@Global()
@Module({
  providers: [GoBridgeService],
  exports: [GoBridgeService],
})
export class CalculatorModule {}
