import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const supabase = await createClient();
    const { data, error } = await supabase.functions.invoke('send-escalation-email', {
      body,
    });

    if (error) {
      console.error('[send-escalation-email] Edge function error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[send-escalation-email] Unexpected error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
