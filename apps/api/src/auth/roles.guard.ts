import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class PlatformOwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const authHeader = request.headers['authorization'];
    const xUserId = request.headers['x-user-id'];

    // If an authorization header was passed but is invalid/expired:
    if (authHeader && !request.isAuthenticated) {
      throw new UnauthorizedException('Invalid or expired authentication token.');
    }

    // If neither authorization header nor x-user-id was provided on an admin route:
    if (!authHeader && !xUserId && !request.isAuthenticated) {
      throw new UnauthorizedException('Authentication required.');
    }

    if (!user) {
      throw new UnauthorizedException('Authentication required.');
    }

    if (user.role !== 'PLATFORM_OWNER' || user.id !== 1) {
      throw new ForbiddenException('Restricted to Platform Owner only.');
    }

    return true;
  }
}

