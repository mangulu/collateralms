import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, message, alertType, collateralId, recipientName, actionUrl } = body;

    if (!to || !message) {
      return NextResponse.json({ error: 'Missing required fields: to, message' }, { status: 400 });
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      return NextResponse.json(
        { error: 'Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.' },
        { status: 500 }
      );
    }

    // Log alert as PENDING in Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: logRow } = await supabase
      .from('sms_alerts')
      .insert({
        recipient_phone: to,
        recipient_name: recipientName ?? null,
        alert_type: alertType ?? 'OVERDUE_COLLATERAL',
        message,
        collateral_id: collateralId ?? null,
        action_url: actionUrl ?? null,
        status: 'PENDING',
      })
      .select()
      .single();

    const alertId = logRow?.id;

    // Send via Twilio REST API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

    const formData = new URLSearchParams({
      To: to,
      From: TWILIO_PHONE_NUMBER,
      Body: message,
    });

    const twilioRes = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      if (alertId) {
        await supabase
          .from('sms_alerts')
          .update({ status: 'FAILED', error_message: twilioData?.message ?? 'Twilio error' })
          .eq('id', alertId);
      }
      return NextResponse.json(
        { error: 'Failed to send SMS', details: twilioData },
        { status: twilioRes.status }
      );
    }

    // Update log to SENT
    if (alertId) {
      await supabase
        .from('sms_alerts')
        .update({ status: 'SENT', twilio_message_sid: twilioData.sid })
        .eq('id', alertId);
    }

    return NextResponse.json({ success: true, messageSid: twilioData.sid, status: 'SENT' });
  } catch (err: any) {
    console.error('SMS send-alert error:', err);
    return NextResponse.json({ error: 'Internal server error', details: err?.message }, { status: 500 });
  }
}
