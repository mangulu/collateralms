import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export async function POST(req: NextRequest) {
  if (!SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'OTP service is not configured' }, { status: 500 });
  }

  const { otpId, code } = await req.json().catch(() => ({}));
  if (!otpId || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'Missing or invalid otpId/code' }, { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: otpRow, error } = await admin
    .from('otp_verifications')
    .select('id, otp_code, expires_at, verified_at, attempts')
    .eq('id', otpId)
    .single();

  if (error || !otpRow) {
    return NextResponse.json({ error: 'Verification code not found. Please sign in again.' }, { status: 404 });
  }
  if (otpRow.verified_at) {
    return NextResponse.json({ error: 'This code has already been used. Please sign in again.' }, { status: 400 });
  }
  if (new Date(otpRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Code expired. Please request a new one.' }, { status: 400 });
  }
  if ((otpRow.attempts ?? 0) >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: 'Too many incorrect attempts. Please sign in again.' }, { status: 429 });
  }

  const submittedHash = hashCode(code);
  const stored = Buffer.from(otpRow.otp_code, 'utf8');
  const submitted = Buffer.from(submittedHash, 'utf8');
  const matches = stored.length === submitted.length && crypto.timingSafeEqual(stored, submitted);

  if (!matches) {
    await admin
      .from('otp_verifications')
      .update({ attempts: (otpRow.attempts ?? 0) + 1 })
      .eq('id', otpId);
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }

  await admin
    .from('otp_verifications')
    .update({ verified_at: new Date().toISOString() })
    .eq('id', otpId);

  return NextResponse.json({ success: true });
}
