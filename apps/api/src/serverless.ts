import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express, Request, Response, NextFunction } from 'express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { isAllowedCorsOrigin } from './main';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';

let cachedServer: Express | null = null;

export async function bootstrapServerless(): Promise<Express> {
  if (!cachedServer) {
    const expressApp = express();
    const adapter = new ExpressAdapter(expressApp);

    const app = await NestFactory.create(AppModule, adapter, {
      logger: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn', 'log'],
    });

    app.use((_req: Request, res: Response, next: NextFunction) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      next();
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );

    app.useGlobalFilters(new GlobalHttpExceptionFilter());

    const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
      : ['http://localhost:3000'];

    app.enableCors({
      origin: (origin, callback) => {
        if (isAllowedCorsOrigin(origin, allowedOrigins)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'x-user-id',
        'X-User-Id',
        'x-snapshot-id',
        'X-Snapshot-Id',
      ],
      exposedHeaders: ['Authorization'],
    });

    await app.init();
    cachedServer = expressApp;
  }
  return cachedServer;
}

export default async function handler(req: Request, res: Response) {
  const server = await bootstrapServerless();
  return server(req, res);
}
