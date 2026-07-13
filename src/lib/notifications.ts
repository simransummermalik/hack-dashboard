import "server-only";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/db/client";
import { members, notifications } from "@/db/schema";
import type { InferInsertModel } from "drizzle-orm";

type NotificationType = InferInsertModel<typeof notifications>["type"];
type EntityType = InferInsertModel<typeof notifications>["entityType"];

export interface NotifyInput {
  memberId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  entityType?: EntityType;
  entityId?: string;
}

/**
 * Outbound delivery channels for a notification, beyond the in-app center.
 * To add another channel (e.g. Discord), implement this interface and
 * register it in `CHANNELS` below — call sites never need to change.
 */
interface NotificationChannel {
  name: string;
  send(input: NotifyInput): Promise<void>;
}

const inAppChannel: NotificationChannel = {
  name: "inApp",
  async send(input) {
    await db.insert(notifications).values({
      memberId: input.memberId,
      type: input.type,
      title: input.title,
      body: input.body ?? "",
      link: input.link,
      entityType: input.entityType,
      entityId: input.entityId,
    });
  },
};

let _resend: Resend | undefined;
function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!_resend) _resend = new Resend(apiKey);
  return _resend;
}

/**
 * Emails a member when something requires their attention, mirroring
 * whatever was shown in-app. Configured via RESEND_API_KEY + EMAIL_FROM; if
 * either is unset, or the member has no email on file, this is a silent
 * no-op — email is additive, never required for the app to function.
 *
 * A failure here (bad API key, provider outage, unverified domain
 * rejecting the recipient, etc.) is logged and swallowed rather than
 * thrown, so a flaky email provider can never make an otherwise-successful
 * action (e.g. creating a task) appear to fail.
 */
const emailChannel: NotificationChannel = {
  name: "email",
  async send(input) {
    const resend = getResend();
    const from = process.env.EMAIL_FROM;
    if (!resend || !from) return;

    try {
      const [member] = await db
        .select({ email: members.email, fullName: members.fullName })
        .from(members)
        .where(eq(members.id, input.memberId))
        .limit(1);

      if (!member?.email) return;

      const appUrl = process.env.APP_URL || "http://localhost:3000";
      const actionUrl = input.link ? `${appUrl}${input.link}` : appUrl;

      await resend.emails.send({
        from,
        to: member.email,
        subject: input.title,
        html: `
          <p>Hi ${member.fullName.split(" ")[0]},</p>
          <p>${input.body ? escapeHtml(input.body) : escapeHtml(input.title)}</p>
          <p><a href="${actionUrl}">View in the HAVK Dashboard</a></p>
        `,
      });
    } catch (err) {
      console.error("Failed to send email notification:", err);
    }
  },
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CHANNELS: NotificationChannel[] = [inAppChannel, emailChannel];

export async function notify(input: NotifyInput): Promise<void> {
  await Promise.all(CHANNELS.map((channel) => channel.send(input)));
}

export async function notifyMany(inputs: NotifyInput[]): Promise<void> {
  await Promise.all(inputs.map((input) => notify(input)));
}
