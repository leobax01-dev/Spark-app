// src/components/BrokerTeamSettings.jsx — Team Management & Seat
// Provisioning. Broker-only. Talks to api/brokerage/team.js (GET for
// roster/seats, POST for invite/revoke) — those writes go through a
// service-role backend endpoint that re-authenticates the caller as a
// broker itself (see api/_lib/brokerage.js requireBroker), not raw
// client-side Supabase writes, since revoking a teammate's access is
// exactly the kind of mutation that shouldn't be gated by RLS alone.
import { useEffect, useState, useCallback } from "react";
import { Card, Label, Button, CopyButton } from "./UI";

const C = {
  bg: "#0a0a0a", surface: "#111111", surfaceUp: "#18181b",
  border: "#27272a", borderMd: "#27272a",
  indigo: "#8b5cf6", indigoLt: "#a78bfa", violet: "#7c3aed",
  cyan: "#38bdf8", emerald: "#10b981", amber: "#f59e0b", rose: "#ef4444",
  text: "rgba(255,255,255,0.95)", textMd: "rgba(255,255,255,0.55)", textDim: "rgba(255,255,255,0.26)",
  F: "'Plus Jakarta Sans',sans-serif",
};

async function authedFetch(path, options = {}) {
  const sb = window.__supabase;
  if (!sb) throw new Error("Supabase isn't initialized yet — try again in a moment.");
  const { data } = await sb.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Your session expired — please sign in again.");
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export default function BrokerTeamSettings({ user }) {
  const [state, setState] = useState({ loading: true, error: null, brokerage: null, members: [], seatLimit: null, activeSeats: 0 });
  const [invite, setInvite] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [revokingId, setRevokingId] = useState(null);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await authedFetch("/api/brokerage/team");
      setState({ loading: false, error: null, ...data });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    if (user?.role === "broker") load();
  }, [user, load]);

  if (user?.role !== "broker") return null;

  async function handleInvite() {
    setInviting(true);
    setInvite(null);
    try {
      const result = await authedFetch("/api/brokerage/team", { method: "POST", body: JSON.stringify({ action: "invite" }) });
      setInvite(result);
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }));
    } finally {
      setInviting(false);
    }
  }

  async function handleRevoke(memberId, email) {
    if (!window.confirm(`Revoke ${email}'s access to this brokerage? They'll keep their SPARK account but lose team visibility.`)) return;
    setRevokingId(memberId);
    try {
      await authedFetch("/api/brokerage/team", { method: "POST", body: JSON.stringify({ action: "revoke", userId: memberId }) });
      await load();
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }));
    } finally {
      setRevokingId(null);
    }
  }

  const seatsRemaining = state.seatLimit != null ? Math.max(0, state.seatLimit - state.activeSeats) : null;

  return (
    <div style={{ maxWidth: 760 }}>
      {state.error && (
        <Card accent={C.rose} C={C} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: C.rose }}>{state.error}</div>
        </Card>
      )}

      <Card accent={C.indigo} C={C} style={{ marginBottom: 18 }}>
        <Label color={C.indigo} C={C}>SEAT CAPACITY</Label>
        {state.loading ? (
          <div style={{ fontSize: 12, color: C.textDim }}>Loading…</div>
        ) : (
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 9, color: C.textDim, letterSpacing: 1.5, marginBottom: 6 }}>ACTIVE SEATS</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>{state.activeSeats}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: C.textDim, letterSpacing: 1.5, marginBottom: 6 }}>SEAT LIMIT ({state.brokerage?.tier?.toUpperCase() || "—"})</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>{state.seatLimit ?? "Custom"}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: C.textDim, letterSpacing: 1.5, marginBottom: 6 }}>REMAINING</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: seatsRemaining === 0 ? C.rose : C.emerald }}>{seatsRemaining ?? "—"}</div>
            </div>
          </div>
        )}
      </Card>

      <Card accent={C.cyan} C={C} style={{ marginBottom: 18 }}>
        <Label color={C.cyan} C={C}>INVITE AN AGENT</Label>
        <Button variant="primary" color={C.cyan} onClick={handleInvite} loading={inviting} C={C} full={false} small>
          Generate Invite Link
        </Button>
        {invite && (
          <div style={{ marginTop: 12, padding: "10px 12px", background: C.surfaceUp, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
            <code style={{ fontSize: 11, color: C.textMd, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{invite.inviteUrl}</code>
            <CopyButton text={invite.inviteUrl} C={C} />
          </div>
        )}
        {invite && <div style={{ fontSize: 10, color: C.textDim, marginTop: 6 }}>Expires {new Date(invite.expiresAt).toLocaleDateString()} · single use</div>}
      </Card>

      <Card accent={C.violet} C={C}>
        <Label color={C.violet} C={C}>ACTIVE SEATS</Label>
        {state.loading && <div style={{ fontSize: 12, color: C.textDim }}>Loading…</div>}
        {!state.loading && state.members.length === 0 && <div style={{ fontSize: 12, color: C.textDim }}>No agents on this brokerage yet.</div>}
        {state.members.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 8px", borderBottom: `1px solid ${C.border}` }}>
            <div>
              <div style={{ fontSize: 12, color: C.text, fontWeight: m.role === "broker" ? 800 : 500 }}>{m.email}</div>
              <div style={{ fontSize: 9, color: C.textDim, letterSpacing: 1, marginTop: 2 }}>{m.role.toUpperCase()} · {m.plan}</div>
            </div>
            {m.role !== "broker" && (
              <Button variant="secondary" color={C.rose} onClick={() => handleRevoke(m.id, m.email)} loading={revokingId === m.id} C={C} full={false} small>
                Revoke Access
              </Button>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}
