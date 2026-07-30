import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  try {
    const {
      to,
      escalationAction,
      workflowName,
      stepName,
      referenceLabel,
      referenceType,
      instanceId,
      triggeredBy,
      slaHours,
      comment,
    } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const recipients: Array<{ name: string; email: string }> = Array.isArray(to) ? to : [to];

    const isHoldPayment = escalationAction === "notify_and_hold";

    const actionLabel = isHoldPayment ? "Notify & Hold Payment" : "Notify Manager";
    const actionColor = isHoldPayment ? "#d97706" : "#2563eb";
    const actionBg = isHoldPayment ? "#fffbeb" : "#eff6ff";
    const actionBorder = isHoldPayment ? "#fde68a" : "#bfdbfe";

    const holdPaymentBanner = isHoldPayment
      ? `
      <tr>
        <td style="padding:0 32px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:14px 16px;">
                <p style="margin:0;font-size:13px;font-weight:700;color:#be123c;">⚠️ Payment Hold Activated</p>
                <p style="margin:4px 0 0;font-size:13px;color:#9f1239;">Any pending payment associated with this workflow has been placed on hold pending resolution of this escalation.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
      : "";

    const commentRow = comment
      ? `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;">Comment</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;font-style:italic;color:#374151;">${comment}</td>
      </tr>`
      : "";

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#1e3a5f;padding:24px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">ContentPro Collateral</h1>
            <p style="margin:4px 0 0;color:#a8c4e0;font-size:13px;">Workflow Escalation Alert</p>
          </td>
        </tr>
        <!-- Action Badge -->
        <tr>
          <td style="padding:24px 32px 16px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:${actionBg};border:1px solid ${actionBorder};border-radius:20px;padding:6px 14px;">
                  <span style="font-size:12px;font-weight:700;color:${actionColor};text-transform:uppercase;letter-spacing:0.5px;">${actionLabel}</span>
                </td>
              </tr>
            </table>
            <h2 style="margin:12px 0 4px;color:#1e3a5f;font-size:18px;font-weight:700;">Escalation Triggered</h2>
            <p style="margin:0;color:#6b7280;font-size:14px;">A workflow step has exceeded its SLA and requires your attention.</p>
          </td>
        </tr>
        <!-- Hold Payment Banner -->
        ${holdPaymentBanner}
        <!-- Details Table -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8ecf0;border-radius:6px;overflow:hidden;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;width:40%;">Field</th>
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Details</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;">Workflow</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:13px;color:#1e3a5f;">${workflowName}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;">Step</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:13px;">${stepName}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;">Reference</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">${referenceLabel ?? referenceType}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;">SLA Exceeded</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#dc2626;font-weight:600;">${slaHours ? `${slaHours} hours idle` : "SLA threshold exceeded"}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;">Triggered By</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">${triggeredBy ?? "System"}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;">Instance ID</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#6b7280;font-family:monospace;">${instanceId}</td>
                </tr>
                ${commentRow}
              </tbody>
            </table>
          </td>
        </tr>
        <!-- CTA -->
        <tr>
          <td style="padding:0 32px 28px;">
            <p style="margin:0 0 16px;color:#374151;font-size:14px;">Please log in to the Collateral Management System to review and take action on this escalation.</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#1e3a5f;border-radius:6px;padding:10px 20px;">
                  <a href="https://contentpro-collateral.com/workflows/instances" style="color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">View Workflow Instance →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e8ecf0;">
            <p style="margin:0;color:#999;font-size:12px;">This is an automated escalation alert from ContentPro Collateral Management System. Do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const subject = isHoldPayment
      ? `🚨 Payment Hold + Escalation: ${stepName} — ${workflowName}`
      : `⚠️ Escalation Alert: ${stepName} — ${workflowName}`;

    const sendResults = await Promise.all(
      recipients.map(async (recipient) => {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "onboarding@resend.dev",
            to: recipient.email,
            subject,
            html: htmlBody,
          }),
        });
        const result = await res.json();
        return { email: recipient.email, success: res.ok, result };
      })
    );

    const failed = sendResults.filter((r) => !r.success);

    return new Response(
      JSON.stringify({
        success: failed.length === 0,
        sent: sendResults.filter((r) => r.success).length,
        failed: failed.length,
        results: sendResults,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
