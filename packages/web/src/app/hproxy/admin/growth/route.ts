import { type NextRequest, NextResponse } from 'next/server';
import { apiHealthUrl, verifyHealthSession, serviceHeaders } from '../_lib';

export async function GET(request: NextRequest) {
  if (!verifyHealthSession(request)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const qs = searchParams.toString();
  const url = apiHealthUrl(`/health/growth${qs ? `?${qs}` : ''}`);
  const res = await fetch(url, { cache: 'no-store', headers: serviceHeaders() });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
