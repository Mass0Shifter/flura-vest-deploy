"use client";
import { useEffect } from "react";
import useSWR from "swr";
import { Bell } from "lucide-react";
import { Card, Empty, cx } from "@fluravest/ui";
import { api, fetcher } from "@fluravest/ui/api";
import { BackHeader } from "@/components/back";
import type { Notification } from "@/lib/types";

export default function NotificationsPage() {
  const { data, mutate } = useSWR<Notification[]>("/notifications", fetcher);
  useEffect(() => {
    if (data?.some((n) => !n.readAt)) {
      const t = setTimeout(() => api("/notifications/read", { body: {} }).then(() => mutate()), 1500);
      return () => clearTimeout(t);
    }
  }, [data, mutate]);
  return (
    <div>
      <BackHeader href="/home" title="Notifications" />
      {data?.length === 0 && <Empty icon={<Bell className="h-6 w-6" />} title="You're all caught up" />}
      <div className="space-y-2">
        {data?.map((n) => (
          <Card key={n.id} className={cx(!n.readAt && "border-green-600/40 bg-positive-subtle")}>
            <p className="text-label text-text">{n.title}</p>
            <p className="text-body-sm text-text-secondary">{n.body}</p>
            <p className="mt-1 text-caption text-text-muted">{new Date(n.createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
