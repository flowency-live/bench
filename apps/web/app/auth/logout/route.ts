import { NextResponse, type NextRequest } from 'next/server';
import { clearSession } from '@/lib/auth/session';

/**
 * Sign out: clear the `bench_session` cookie and return to the login screen.
 *
 * Exposed as both GET (so a plain `<a href="/auth/logout">` works) and POST.
 */
async function logout(request: NextRequest): Promise<NextResponse> {
  await clearSession();
  return NextResponse.redirect(new URL('/login', request.url));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return logout(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return logout(request);
}
