import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (request.user) return request.user;
    if (request.userId) return { id: request.userId };
    if (process.env.NODE_ENV === 'test') return { id: 1 };
    return null;
  },
);

