import { and, desc, eq, isNull } from "drizzle-orm";
import type { DbLike } from "../db/client";
import { notifications } from "../db/schema";

/**
 * In-app notification, written in the caller's transaction (an outbox: if the money movement
 * rolls back, the message does too). SMS/WhatsApp/email delivery would be a worker reading this table.
 */
export async function notify(tx: DbLike, userId: string, title: string, body: string) {
  await tx.insert(notifications).values({ userId, title, body });
}

export async function listNotifications(db: DbLike, userId: string) {
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(30);
}

export async function markAllRead(db: DbLike, userId: string) {
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
