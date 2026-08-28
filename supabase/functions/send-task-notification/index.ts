import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

declare const Deno: { env: { get(key: string): string | undefined } };

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
      assigneeName,
      assigneeEmail,
      taskTitle,
      workflowName,
      assignedByName,
      deadline,
      deepLink,
      collateralId,
      type, // 'assignment' | 'deadline'
    } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const isDeadline = type === "deadline";
    const subject = isDeadline
      ? `⏰ Deadline Approaching: ${taskTitle}`
      : `📋 New Task Assigned: ${taskTitle}`;

    const headerColor = isDeadline ? "#b45309" : "#1e3a5f";
    const headerBg = isDeadline ? "#fffbeb" : "#1e3a5f";
    const headerText = isDeadline ? "#92400e" : "#ffffff";
    const badgeBg = isDeadline ? "#fef3c7" : "#dbeafe";
    const badgeText = isDeadline ? "#92400e" : "#1e40af";
    const badgeLabel = isDeadline ? "⏰ Deadline Approaching" : "📋 New Assignment";

    const deadlineRow = deadline
      ? `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;">Deadline</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;font-weight:600;color:${isDeadline ? '#b45309' : '#374151'};">${new Date(deadline).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
        </tr>`
      : "";

    const collateralRow = collateralId
      ? `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;">Collateral ID</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;font-family:monospace;color:#1e3a5f;">${collateralId}</td>
        </tr>`
      : "";

    const ctaUrl = deepLink ?? "https://contentpro-collateral.com/staff-workspace";

    const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:${headerBg};padding:24px 32px;">
            <h1 style="margin:0;color:${headerText};font-size:20px;font-weight:700;">ContentPro Collateral</h1>
            <p style="margin:4px 0 0;color:${isDeadline ? '#d97706' : '#a8c4e0'};font-size:13px;">Staff Workspace Notification</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 16px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:${badgeBg};border-radius:20px;padding:6px 16px;">
                  <span style="font-size:13px;font-weight:700;color:${badgeText};">${badgeLabel}</span>
                </td>
              </tr>
            </table>
            <h2 style="margin:14px 0 4px;color:#1e3a5f;font-size:18px;font-weight:700;">Hello, ${assigneeName}</h2>
            <p style="margin:0;color:#6b7280;font-size:14px;">${isDeadline ? `The deadline for your task is approaching. Please take action before the due date.` : `A new task has been assigned to you in the ${workflowName} workflow.`}</p>
          </td>
        </tr>
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
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;">Task</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:13px;color:#1e3a5f;">${taskTitle}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;">Workflow</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">${workflowName}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;">Assigned By</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">${assignedByName}</td>
                </tr>
                ${deadlineRow}
                ${collateralRow}
              </tbody>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 28px;">
            <p style="margin:0 0 16px;color:#374151;font-size:14px;">Log in to your Staff Workspace to view and action this task.</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#1e3a5f;border-radius:6px;padding:10px 20px;">
                  <a href="${ctaUrl}" style="color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">Open Task →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e8ecf0;">
            <p style="margin:0;color:#999;font-size:12px;">This is an automated notification from ContentPro Collateral Management System. Do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: assigneeEmail,
        subject,
        html: htmlBody,
      }),
    });

    const result = await res.json();

    return new Response(JSON.stringify({ success: res.ok, result }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
