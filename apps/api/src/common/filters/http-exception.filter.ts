import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

const STATUS_ERROR_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
  [HttpStatus.BAD_GATEWAY]: 'BAD_GATEWAY',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let message: string | string[] = 'An unexpected server error occurred.';
    let guidance: string | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      errorCode = STATUS_ERROR_CODES[statusCode] || 'HTTP_ERROR';
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (exceptionResponse && typeof exceptionResponse === 'object') {
        const body = exceptionResponse as Record<string, any>;
        message = body.message || exception.message || message;
        if (typeof body.errorCode === 'string') {
          errorCode = body.errorCode;
        }
        if (typeof body.guidance === 'string' && body.guidance.trim()) {
          guidance = body.guidance;
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        statusCode = HttpStatus.CONFLICT;
        errorCode = 'CONFLICT_DUPLICATE';
        message = 'A conflicting record already exists.';
      } else if (exception.code === 'P2025') {
        statusCode = HttpStatus.NOT_FOUND;
        errorCode = 'NOT_FOUND';
        message = 'Requested ledger record was not found.';
      } else if (exception.code === 'P2003') {
        statusCode = HttpStatus.BAD_REQUEST;
        errorCode = 'FOREIGN_KEY_VIOLATION';
        message = 'Invalid relation reference supplied.';
      } else if (['P1001', 'P1008', 'P1017', 'P2024'].includes(exception.code)) {
        statusCode = HttpStatus.SERVICE_UNAVAILABLE;
        errorCode = 'SERVICE_UNAVAILABLE';
        message = 'Database connection temporarily unavailable.';
      } else {
        this.logger.error(`Unhandled Prisma error [${exception.code}]: ${exception.message}`);
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled exception on ${request?.method} ${request?.url}: ${exception.message}`, exception.stack);
      if (process.env.NODE_ENV !== 'production') {
        message = exception.message;
      }
    }

    if (response.headersSent) {
      return;
    }

    response.status(statusCode).json({
      statusCode,
      errorCode,
      message,
      ...(guidance ? { guidance } : {}),
      path: request?.url ?? '/',
      timestamp: new Date().toISOString(),
    });
  }
}
