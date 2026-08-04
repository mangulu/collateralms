import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: string; description: string }> = {
  Rejected: {
    label: "Rejected",
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    icon: "✗",
    description: "This collateral has been rejected and requires attention.",
  },
  Released: {
    label: "Released",
    color: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    icon: "✓",
    description: "This collateral has been successfully released.",
  },
  Perfected: {
    label: "Perfected",
    color: "#2563eb",
    bg: "#eff6ff",
    border: "#bfdbfe",
    icon: "★",
    description: "This collateral has been perfected and is now legally registered.",
  },
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
      newStatus,
      collateralId,
      collateralDescription,
      obligor,
      collateralType,
      changedBy,
      notes,
      workflowType,
    } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const recipients: Array<{ name: string; email: string }> = Array.isArray(to) ? to : [to];
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, skipped: "no recipients" }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const cfg = STATUS_CONFIG[newStatus] ?? {
      label: newStatus,
      color: "#6b7280",
      bg: "#f9fafb",
      border: "#e5e7eb",
      icon: "●",
      description: `Collateral status has been updated to ${newStatus}.`,
    };

    const notesRow = notes
      ? `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;">Notes</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;font-style:italic;color:#374151;">${notes}</td>
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
            <p style="margin:4px 0 0;color:#a8c4e0;font-size:13px;">Collateral Status Alert</p>
          </td>
        </tr>
        <!-- Status Badge -->
        <tr>
          <td style="padding:24px 32px 16px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:${cfg.bg};border:1px solid ${cfg.border};border-radius:20px;padding:6px 16px;">
                  <span style="font-size:13px;font-weight:700;color:${cfg.color};">${cfg.icon} ${cfg.label}</span>
                </td>
              </tr>
            </table>
            <h2 style="margin:14px 0 4px;color:#1e3a5f;font-size:18px;font-weight:700;">Collateral Status Changed</h2>
            <p style="margin:0;color:#6b7280;font-size:14px;">${cfg.description}</p>
          </td>
        </tr>
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
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;">Collateral ID</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:13px;color:#1e3a5f;font-family:monospace;">${collateralId ?? "—"}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;">Description</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">${collateralDescription ?? "—"}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;">Obligor</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">${obligor ?? "—"}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;">Collateral Type</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">${collateralType ?? "—"}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;">New Status</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;font-weight:700;color:${cfg.color};">${cfg.label}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;">Workflow</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">${workflowType ?? "—"}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;">Changed By</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">${changedBy ?? "System"}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;">Timestamp</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#6b7280;">${new Date().toUTCString()}</td>
                </tr>
                ${notesRow}
              </tbody>
            </table>
          </td>
        </tr>
        <!-- CTA -->
        <tr>
          <td style="padding:0 32px 28px;">
            <p style="margin:0 0 16px;color:#374151;font-size:14px;">Log in to the Collateral Management System to view the full record and take any required action.</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#1e3a5f;border-radius:6px;padding:10px 20px;">
                  <a href="https://contentpro-collateral.com/collateral-management" style="color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">View Collateral →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e8ecf0;">
            <p style="margin:0;color:#999;font-size:12px;">This is an automated status alert from ContentPro Collateral Management System. Do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const subject = `${cfg.icon} Collateral ${cfg.label}: ${collateralId ?? collateralDescription ?? "Status Update"}`;

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
