"use client";
import useSWR from "swr";
import { Badge, Button, Money } from "@fluravest/ui";
import { api, ApiError, fetcher } from "@fluravest/ui/api";
import { PageHeader, Table, Td } from "@/components/ui";

type Member = { id: string; fullName: string; email: string; kycTier: number; status: string; createdAt: string; available: string; escrow: string };

export default function MembersPage() {
  const { data, mutate } = useSWR<Member[]>("/admin/members", fetcher);
  async function toggle(m: Member) {
    const reason = window.prompt(`Reason for ${m.status === "active" ? "freezing" : "unfreezing"} ${m.fullName}'s account`);
    if (!reason) return;
    try {
      await api(`/admin/members/${m.id}/status`, { body: { status: m.status === "active" ? "frozen" : "active", reason } });
      mutate();
    } catch (x) {
      alert(x instanceof ApiError ? x.message : "Failed");
    }
  }
  return (
    <div>
      <PageHeader title="Members" subtitle="Contact details are masked. Freezing blocks deposits, claims and withdrawals." />
      <Table head={["Member", "KYC", "Status", "Available", "In escrow", "Joined", ""]}>
        {data?.map((m) => (
          <tr key={m.id}>
            <Td>{m.fullName}<span className="block text-caption text-text-muted">{m.email}</span></Td>
            <Td><Badge tone={m.kycTier >= 2 ? "positive" : "warning"}>Tier {m.kycTier}</Badge></Td>
            <Td><Badge tone={m.status === "active" ? "neutral" : "negative"}>{m.status}</Badge></Td>
            <Td><Money kobo={m.available} /></Td>
            <Td><Money kobo={m.escrow} /></Td>
            <Td>{new Date(m.createdAt).toLocaleDateString("en-NG", { dateStyle: "medium" })}</Td>
            <Td><Button size="sm" variant="outline" onClick={() => toggle(m)}>{m.status === "active" ? "Freeze" : "Unfreeze"}</Button></Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
