import { NextResponse } from 'next/server';
import { healthAuthHeaders, apiHealthUrl } from './_lib';

export async function GET() {
  const res = await fetch(apiHealthUrl('/health'), {
    headers: healthAuthHeaders(),
    cache: 'no-store',
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
