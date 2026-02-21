import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionContext } from '@nestjs/common';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
	constructor(private prisma: PrismaService) {
		super();
	}

	// Override to perform additional checks after JWT validation
	async handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
		// let Passport/Nest handle basic errors
		const req = context.switchToHttp().getRequest();

		if (err || !user) {
			return super.handleRequest(err, user, info, context);
		}

		// Check license expiry
		try {
			const license = await this.prisma.licenseKey.findUnique({ where: { id: user.licenseKeyId } });
			const now = new Date();
			if (license?.expiresAt && now > license.expiresAt) {
				// Expired: invalidate this session (based on jwt token) and deny access
				const authHeader = (req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
				if (authHeader) {
					await this.prisma.userSession.updateMany({ where: { jwtToken: authHeader }, data: { expiresAt: now } });
				}
				throw new UnauthorizedException('Chave expirada');
			}

			// Also check session expiry for this token
			const authToken = (req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
			if (authToken) {
				const session = await this.prisma.userSession.findUnique({ where: { jwtToken: authToken } });
				if (session && session.expiresAt && now > session.expiresAt) {
					throw new UnauthorizedException('Sessão expirada');
				}
			}
		} catch (e) {
			if (e instanceof UnauthorizedException) throw e;
			// on DB errors, log and rethrow as unauthorized to be safe
			throw new UnauthorizedException('Erro ao validar sessão');
		}

		return user;
	}
}
