"use client";
import { useState } from "react";
import useSWR from "swr";
import { Alert, Button, Card, Field, Input } from "@fluravest/ui";
import { api, ApiError, fetcher } from "@fluravest/ui/api";
import { PageHeader, Table, Td } from "@/components/ui";

type W = { id: string; startsOn: string; endsOn: string; label: string };
const iso = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(d);

export default function WindowsPage() {
  const { data, mutate } = useSWR<W[]>("/admin/windows", fetcher);
  const today = iso(new Date());
  const [f, setF] = useState({ startsOn: today, endsOn: iso(new Date(Date.now() + 2 * 86_400_000)), label: "Demo window" });
  const [err, setErr] = useState<string>();
  const [ok, setOk] = useState<string>();
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(undefined);
    setOk(undefined);
    try {
      await api("/admin/windows", { body: f });
      setOk("Window added. Members see it immediately.");
      mutate();
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Failed");
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Free withdrawal windows" subtitle="Outside these dates, withdrawals carry the 5% early fee. Dates are in Lagos time. Finance approvers only." />
      <Card>
        <form onSubmit={add} className="grid items-end gap-3 md:grid-cols-4">
          <Field label="Starts" htmlFor="s"><Input id="s" type="date" value={f.startsOn} onChange={(e) => setF({ ...f, startsOn: e.target.value })} /></Field>
          <Field label="Ends" htmlFor="e"><Input id="e" type="date" value={f.endsOn} onChange={(e) => setF({ ...f, endsOn: e.target.value })} /></Field>
          <Field label="Label" htmlFor="l"><Input id="l" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></Field>
          <Button type="submit">Add window</Button>
        </form>
        <div className="mt-3">{err && <Alert tone="negative">{err}</Alert>}{ok && <Alert tone="positive">{ok}</Alert>}</div>
      </Card>
      <Table head={["Label", "Starts", "Ends", "", ""]}>
        {data?.map((w) => {
          const live = w.startsOn <= today && today <= w.endsOn;
          return (
            <tr key={w.id}>
              <Td className="font-semibold">{w.label}</Td>
              <Td>{w.startsOn}</Td>
              <Td>{w.endsOn}</Td>
              <Td>{live ? <span className="text-text-positive">Open now</span> : w.endsOn < today ? <span className="text-text-muted">Past</span> : ""}</Td>
              <Td><Button size="sm" variant="ghost" onClick={async () => { try { await api(`/admin/windows/${w.id}`, { method: "DELETE" }); mutate(); } catch (x) { setErr(x instanceof ApiError ? x.message : "Failed"); } }}>Remove</Button></Td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
