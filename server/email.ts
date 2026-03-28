import sgMail from "@sendgrid/mail";

function init() {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) throw new Error("SENDGRID_API_KEY must be set");
  sgMail.setApiKey(key);
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  init();
  const from = process.env.SENDGRID_FROM_EMAIL;
  if (!from) throw new Error("SENDGRID_FROM_EMAIL must be set");
  await sgMail.send({ to, from, subject, html });
}

export function buildReminderEmail(
  daysUntil: number,
  installmentLabel: string,
  installmentAmountInr: number,
  dueDate: string
): { subject: string; html: string } {
  const amount = `₹${Math.round(installmentAmountInr).toLocaleString("en-IN")}`;
  const urgency = daysUntil === 0 ? "TODAY" : `in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`;
  const subject = daysUntil === 0
    ? `⚠️ Advance Tax Due TODAY — ${amount} (${installmentLabel})`
    : `📅 Advance Tax Reminder — ${amount} due ${urgency} (${installmentLabel})`;

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 8px;color:#1a1a2e">Advance Tax Reminder</h2>
      <p style="color:#555;margin:0 0 20px">Your estimated advance tax installment is due <strong>${urgency}</strong>.</p>
      <div style="background:#fef9ec;border:1px solid #f59e0b;border-radius:12px;padding:20px;margin-bottom:20px">
        <p style="margin:0 0 4px;font-size:12px;color:#92400e;text-transform:uppercase;letter-spacing:.05em">${installmentLabel}</p>
        <p style="margin:0;font-size:28px;font-weight:700;color:#1a1a2e">${amount}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#555">Due date: ${dueDate}</p>
      </div>
      <p style="color:#777;font-size:13px">Log in to <a href="https://upwork-tracker.triggerandflow.in/tax" style="color:#f59e0b">TimeTrakr</a> to see your full tax breakdown.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
      <p style="color:#aaa;font-size:11px">You're receiving this because you enabled tax reminders. <a href="https://upwork-tracker.triggerandflow.in/settings" style="color:#aaa">Manage preferences</a>.</p>
    </div>`;

  return { subject, html };
}

// Advance tax due dates for a given FY start year (April = month index 3)
export function getAdvanceTaxDates(fyStartYear: number) {
  return [
    { label: "Q1 (15%)",  dueDate: new Date(fyStartYear,     5, 15), cumulativePct: 0.15 },
    { label: "Q2 (45%)",  dueDate: new Date(fyStartYear,     8, 15), cumulativePct: 0.45 },
    { label: "Q3 (75%)",  dueDate: new Date(fyStartYear,    11, 15), cumulativePct: 0.75 },
    { label: "Q4 (100%)", dueDate: new Date(fyStartYear + 1, 2, 15), cumulativePct: 1.00 },
  ];
}

export function getFyStartYear(date: Date): number {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}
