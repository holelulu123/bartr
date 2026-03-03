import { type NextRequest, NextResponse } from 'next/server';
import { healthAuthHeaders, apiHealthUrl } from '../_lib';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const qs = searchParams.toString();
  const url = apiHealthUrl(`/health/history${qs ? `?${qs}` : ''}`);
  const res = await fetch(url, {
    headers: healthAuthHeaders(),
    cache: 'no-store',
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
