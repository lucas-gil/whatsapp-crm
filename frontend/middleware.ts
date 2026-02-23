import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Nome do cookie onde o token de acesso é salvo (ajuste se necessário)
const authCookieName = 'accessToken';

// Rotas públicas que não devem ser protegidas pelo middleware
const publicPaths = ['/login', '/api/auth', '/api/auth/login', '/_next', '/favicon.ico', '/static'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Permite recursos estáticos e rotas públicas
  if (publicPaths.some(p => pathname.startsWith(p))) return NextResponse.next();

  // Tenta obter token do cookie
  const token = req.cookies.get(authCookieName)?.value;

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    // opcional: manter destino original
    url.search = `redirect=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next|static|favicon.ico).*)'],
};
