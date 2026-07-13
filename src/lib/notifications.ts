import "server-only";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";
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
 * Only "inApp" is implemented today. To add email or Discord delivery,
 * implement this interface and register it in `CHANNELS` below — call
 * sites never need to change.
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

// Future channels (email, Discord webhook, etc.) get pushed here. Each
// channel receives the same NotifyInput and is responsible for its own
// delivery + failure handling; a failure in one channel must not block
// others.
const CHANNELS: NotificationChannel[] = [inAppChannel];

export async function notify(input: NotifyInput): Promise<void> {
  await Promise.all(CHANNELS.map((channel) => channel.send(input)));
}

export async function notifyMany(inputs: NotifyInput[]): Promise<void> {
  await Promise.all(inputs.map((input) => notify(input)));
}
