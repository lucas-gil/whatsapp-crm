import { Injectable, UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
	constructor(private prisma: PrismaService) {
		super();
	}

	// Use canActivate so we can perform async DB checks after Passport validates the JWT
	async canActivate(context: ExecutionContext) {
		const base = (await super.canActivate(context)) as boolean;
		if (!base) return false;

		const req = context.switchToHttp().getRequest();
		const user = req.user as any;
		if (!user) return false;

		try {
			const license = await this.prisma.licenseKey.findUnique({ where: { id: user.licenseKeyId } });
			const now = new Date();
			if (license?.expiresAt && now > license.expiresAt) {
				const authHeader = (req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
				if (authHeader) {
					await this.prisma.userSession.updateMany({ where: { jwtToken: authHeader }, data: { expiresAt: now } });
				}
				throw new UnauthorizedException('Chave expirada');
			}

			const authToken = (req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
			if (authToken) {
				const session = await this.prisma.userSession.findUnique({ where: { jwtToken: authToken } });
				if (session && session.expiresAt && now > session.expiresAt) {
					throw new UnauthorizedException('Sessão expirada');
				}
			}
		} catch (e) {
			if (e instanceof UnauthorizedException) throw e;
			throw new UnauthorizedException('Erro ao validar sessão');
		}

		return true;
	}
}
