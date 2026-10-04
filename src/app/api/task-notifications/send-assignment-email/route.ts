import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * @swagger
 * /api/task-notifications/send-assignment-email:
 *   post:
 *     tags: [Notifications]
 *     summary: Proxy to the send-task-notification Supabase Edge Function (type=assignment)
 *     description: Request body is forwarded to the edge function with `type` forced to "assignment".
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
    const { data, error } = await supabase.functions.invoke('send-task-notification', {
      body: { ...body, type: 'assignment' },
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
