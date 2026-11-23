import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import {
  IdempotencyService,
  hashRequestPayload,
} from './idempotency.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotencyService: IdempotencyService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const rawKey = req?.headers?.['idempotency-key'];
    const key = this.idempotencyService.normalizeKey(rawKey);

    if (!key) {
      return next.handle();
    }

    const userId =
      req?.user?.id ||
      req?.userId ||
      (process.env.NODE_ENV === 'test' ? 1 : null);

    if (!userId) {
      return next.handle();
    }

    const method = String(req.method || 'POST').toUpperCase();
    const routePath =
      req?.route?.path !== undefined
        ? `${req.baseUrl || ''}${req.route.path}`
        : String(req.originalUrl || req.url || '').split('?')[0];
    const requestHash = hashRequestPayload(req.body);

    const cached = await this.idempotencyService.lookup({
      userId,
      method,
      path: routePath,
      key,
      requestHash,
    });

    if (cached) {
      if (typeof res?.setHeader === 'function') {
        res.setHeader('X-Idempotency-Replayed', 'true');
      }
      if (typeof res?.status === 'function' && cached.statusCode) {
        res.status(cached.statusCode);
      }
      return of(cached.responseJson);
    }

    return next.handle().pipe(
      switchMap((responseBody) =>
        from(
          this.idempotencyService
            .save({
              userId,
              method,
              path: routePath,
              key,
              requestHash,
              statusCode: res?.statusCode || 200,
              responseJson: responseBody,
            })
            .then(() => {
              if (typeof res?.setHeader === 'function') {
                res.setHeader('X-Idempotency-Replayed', 'false');
              }
              return responseBody;
            }),
        ),
      ),
    );
  }
}
