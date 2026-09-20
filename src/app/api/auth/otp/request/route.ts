import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_REQUESTS_PER_HOUR = 5;

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export async function POST(req: NextRequest) {
  if (!SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'OTP service is not configured' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const { userId: requestedUserId, otpId: resendOtpId } = body ?? {};

  if (!requestedUserId && !resendOtpId) {
    return NextResponse.json({ error: 'Missing userId or otpId' }, { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Resolve which account this request is for, and how it's authorized:
  // - A fresh login supplies userId + the access token just issued by
  //   signInWithPassword, proving the caller really does hold that account's
  //   credentials.
  // - A "Resend code" click happens after the login session was already
  //   signed out, so it can only reference the otpId it was handed earlier;
  //   the per-account rate limits below bound how much that can be abused.
  let userId: string;
  if (requestedUserId) {
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
    }
    const anonClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: authData, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !authData?.user || authData.user.id !== requestedUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    userId = requestedUserId;
  } else {
    const { data: existingOtp } = await admin
      .from('otp_verifications')
      .select('user_id')
      .eq('id', resendOtpId)
      .single();
    if (!existingOtp?.user_id) {
      return NextResponse.json({ error: 'Verification session not found. Please sign in again.' }, { status: 404 });
    }
    userId = existingOtp.user_id;
  }

  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('phone, is_active')
    .eq('id', userId)
    .single();

  if (profileError || !profile?.phone) {
    return NextResponse.json({ error: 'No phone number on file for this account' }, { status: 400 });
  }
  if (profile.is_active === false) {
    return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
  }

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await admin
    .from('otp_verifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since);

  if ((recentCount ?? 0) >= MAX_REQUESTS_PER_HOUR) {
    return NextResponse.json({ error: 'Too many verification codes requested. Please try again later.' }, { status: 429 });
  }

  const { data: lastOtp } = await admin
    .from('otp_verifications')
    .select('created_at')
    .eq('user_id', userId)
    .is('verified_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastOtp && Date.now() - new Date(lastOtp.created_at).getTime() < RESEND_COOLDOWN_MS) {
    return NextResponse.json({ error: 'Please wait before requesting another code' }, { status: 429 });
  }

  // Invalidate any still-pending codes so only the latest one can ever verify
  await admin
    .from('otp_verifications')
    .update({ expires_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('verified_at', null);

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  const { data: otpRow, error: insertError } = await admin
    .from('otp_verifications')
    .insert({ user_id: userId, phone: profile.phone, otp_code: hashCode(code), expires_at: expiresAt })
    .select('id')
    .single();

  if (insertError || !otpRow) {
    return NextResponse.json({ error: 'Failed to generate verification code' }, { status: 500 });
  }

  let delivered = false;
  try {
    const smsRes = await fetch(new URL('/api/sms/send-alert', req.nextUrl.origin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: profile.phone,
        message: `[CollateralMS] Your login code is: ${code}. Valid 10 minutes.`,
        alertType: 'APPROVAL_REQUEST',
      }),
    });
    const smsData = await smsRes.json().catch(() => ({ success: false }));
    delivered = smsData?.success === true;
  } catch {
    delivered = false;
  }

  return NextResponse.json({
    otpId: otpRow.id,
    delivered,
    // Only surfaced when SMS genuinely could not be sent (e.g. no Twilio
    // configured in this environment) -- mirrors the previous "Demo mode"
    // fallback, but the code is never sent to the browser when delivery
    // actually succeeds.
    devCode: delivered ? undefined : code,
  });
}
