import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// This route is deprecated. Zoho auto-setup has been removed from FirstHey.
export async function POST() {
  return NextResponse.json({ error: 'Zoho integration is disabled.' }, { status: 410 });
}
