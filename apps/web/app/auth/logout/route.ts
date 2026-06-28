import { NextResponse, type NextRequest } from 'next/server';
import { clearSession, getSession } from '@/lib/auth/session';

/**
 * Sign out: clear the `bench_session` cookie and return to the login screen.
 *
 * Exposed as both GET (so a plain `<a href="/auth/logout">` works) and POST.
 * Platform sessions redirect to /godmode/login, others to /login.
 */
async function logout(request: NextRequest): Promise<NextResponse> {
  // Check session type before clearing to determine redirect
  const session = await getSession();
  const isPlatform = session?.kind === 'platform';

  await clearSession();

  // In Amplify SSR, request.url returns localhost. Use host header.
  const host = request.headers.get('host') ?? request.headers.get('x-forwarded-host') ?? 'localhost:3000';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const origin = `${protocol}://${host}`;

  const redirectPath = isPlatform ? '/godmode/login' : '/login';
  return NextResponse.redirect(`${origin}${redirectPath}`);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return logout(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return logout(request);
}
