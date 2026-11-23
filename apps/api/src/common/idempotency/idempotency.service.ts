import * as crypto from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export function stableJsonStringify(value: any): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableJsonStringify(v)).join(',')}]`;
  }
  const keys = Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableJsonStringify(value[k])}`)
    .join(',')}}`;
}

export function hashRequestPayload(body: any): string {
  const canonical = stableJsonStringify(body ?? {});
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

@Injectable()
export class IdempotencyService {
  private readonly TTL_MS = 24 * 60 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  normalizeKey(rawKey: string | string[] | undefined): string | null {
    if (!rawKey) return null;
    const raw = (Array.isArray(rawKey) ? rawKey[0] : rawKey).trim();
    if (!raw) return null;
    if (raw.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(raw)) {
      throw new BadRequestException(
        'Idempotency-Key must be 1-128 characters of [A-Za-z0-9._:-].',
      );
    }
    return raw;
  }

  hasStore(): boolean {
    return typeof (this.prisma as any)?.idempotencyRecord?.findUnique === 'function';
  }

  async lookup(params: {
    userId: number;
    method: string;
    path: string;
    key: string;
    requestHash: string;
  }): Promise<{ statusCode: number; responseJson: any } | null> {
    if (!this.hasStore()) return null;

    const existing = await (this.prisma as any).idempotencyRecord.findUnique({
      where: {
        userId_method_path_key: {
          userId: params.userId,
          method: params.method,
          path: params.path,
          key: params.key,
        },
      },
    });

    if (!existing) return null;

    if (new Date(existing.expiresAt).getTime() <= Date.now()) {
      await (this.prisma as any).idempotencyRecord
        .deleteMany({
          where: {
            userId: params.userId,
            method: params.method,
            path: params.path,
            key: params.key,
          },
        })
        .catch(() => {});
      return null;
    }

    if (existing.requestHash !== params.requestHash) {
      throw new ConflictException(
        'Idempotency-Key reuse with different request payload is forbidden.',
      );
    }

    return {
      statusCode: existing.statusCode,
      responseJson: existing.responseJson,
    };
  }

  async save(params: {
    userId: number;
    method: string;
    path: string;
    key: string;
    requestHash: string;
    statusCode: number;
    responseJson: any;
  }): Promise<void> {
    if (!this.hasStore()) return;
    const expiresAt = new Date(Date.now() + this.TTL_MS);

    try {
      await (this.prisma as any).idempotencyRecord.create({
        data: {
          userId: params.userId,
          method: params.method,
          path: params.path,
          key: params.key,
          requestHash: params.requestHash,
          statusCode: params.statusCode,
          responseJson: params.responseJson ?? {},
          expiresAt,
        },
      });
    } catch {
      // Ignore concurrent insert race if exact same request already saved
    }
  }
}
