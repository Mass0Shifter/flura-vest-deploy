"use client";
import useSWR from "swr";
import { fetcher } from "@fluravest/ui/api";
import { PageHeader, Table, Td } from "@/components/ui";

type E = { id: number; actorType: string; actorId: string | null; action: string; entity: string; entityId: string | null; data: Record<string, unknown>; hash: string; createdAt: string };

export default function AuditPage() {
  const { data } = useSWR<E[]>("/admin/audit", fetcher, { refreshInterval: 15_000 });
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Append-only and hash-chained: each entry's hash covers the one before it, so edits or deletions are detectable." />
      <Table head={["#", "When", "Actor", "Action", "Entity", "Details", "Hash"]}>
        {data?.map((e) => (
          <tr key={e.id}>
            <Td className="text-text-muted">{e.id}</Td>
            <Td>{new Date(e.createdAt).toLocaleString("en-NG", { dateStyle: "short", timeStyle: "medium" })}</Td>
            <Td>{e.actorType}<span className="block font-mono text-caption text-text-muted">{e.actorId?.slice(0, 8)}</span></Td>
            <Td className="font-semibold">{e.action}</Td>
            <Td>{e.entity}<span className="block font-mono text-caption text-text-muted">{e.entityId?.slice(0, 8)}</span></Td>
            <Td className="max-w-xs truncate font-mono text-caption">{JSON.stringify(e.data)}</Td>
            <Td className="font-mono text-caption text-text-muted">{e.hash.slice(0, 12)}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
