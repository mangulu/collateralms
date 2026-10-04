import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * @swagger
 * /api/collateral/send-status-email:
 *   post:
 *     tags: [Notifications]
 *     summary: Proxy to the send-collateral-status-email Supabase Edge Function
 *     description: Request body is forwarded verbatim to the edge function.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       200:
 *         description: Edge function result
 *       500:
 *         description: Edge function error or unexpected failure
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const supabase = await createClient();
    const { data, error } = await supabase.functions.invoke('send-collateral-status-email', {
      body,
    });

    if (error) {
      console.error('[send-collateral-status-email] Edge function error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[send-collateral-status-email] Unexpected error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
