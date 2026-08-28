import { NextResponse, type NextRequest } from 'next/server';
import {
  ACCESS_COOKIE,
  AUTH_HINT_COOKIE,
  REFRESH_COOKIE,
  loadSessionUser,
  rotateRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from '@/lib/auth';

/**
 * Silent session refresh.
 *
 * Access tokens live for 15 minutes; refresh tokens for 30 days. Without this,
 * a writer mid-submission would be bounced to the sign-in page the moment the
 * access token lapsed — the refresh infrastructure existed but nothing invoked
 * it. Cookies cannot be written during a server-component render, so the
 * rotation happens here, on the way into the authenticated surfaces.
 *
 * Rotation is single-use by design (the revoke is the guard), so it only runs
 * for document navigations: the fresh cookies from the first response cover the
 * page's follow-up requests, and two racing rotations cannot both win.
 */
export async function proxy(req: NextRequest) {
  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  if (access && (await verifyAccessToken(access))) return NextResponse.next();

  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  // Document navigations and server-action POSTs are both single user-intent
  // requests; a form submitted after the access token lapsed must succeed, not
  // bounce with "please sign in again". Prefetch/RSC requests are excluded so
  // parallel fetches cannot race the single-use rotation.
  const isDocument = req.headers.get('accept')?.includes('text/html') ?? false;
  const isServerAction = req.method === 'POST' && req.headers.has('next-action');
  if (!refresh || !(isDocument || isServerAction)) return NextResponse.next();

  try {
    const rotated = await rotateRefreshToken(refresh);
    if (!rotated) return NextResponse.next(); // revoked/expired — page guards redirect to sign-in

    const user = await loadSessionUser(rotated.userId);
    if (!user) return NextResponse.next();

    const token = await signAccessToken(user);
    const response = NextResponse.next({
      request: { headers: withFreshAccess(req, token) },
    });
    const secure = process.env.NODE_ENV === 'production';
    const accessTtl = Number(process.env.ACCESS_TTL ?? 900);
    const refreshTtl = Number(process.env.REFRESH_TTL ?? 2_592_000);
    response.cookies.set(ACCESS_COOKIE, token, {
      httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: accessTtl,
    });
    response.cookies.set(REFRESH_COOKIE, rotated.newRaw, {
      httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: refreshTtl,
    });
    response.cookies.set(AUTH_HINT_COOKIE, '1', {
      httpOnly: false, sameSite: 'lax', secure, path: '/', maxAge: refreshTtl,
    });
    return response;
  } catch (e) {
    // A refresh failure must never take the page down — fall through to the
    // page's own guard, which redirects to sign-in.
    console.error(`[proxy:refresh] ${(e as Error).message}`);
    return NextResponse.next();
  }
}

/** The current render must also see the new token, not just the next request. */
function withFreshAccess(req: NextRequest, token: string): Headers {
  const headers = new Headers(req.headers);
  const cookies = (headers.get('cookie') ?? '')
    .split(';')
    .map((c) => c.trim())
    .filter((c) => c && !c.startsWith(`${ACCESS_COOKIE}=`));
  cookies.push(`${ACCESS_COOKIE}=${token}`);
  headers.set('cookie', cookies.join('; '));
  return headers;
}

export const config = {
  matcher: ['/dashboard/:path*', '/submit', '/api/files/:path*', '/api/export/:path*'],
};
