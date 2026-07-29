// api/_lib/brokerage.js — shared Brokerage Command Suite helpers.
// Not a route. Used by api/brokerage/*.js and api/billing/brokerage-checkout.js.
import { createClient } from "@supabase/supabase-js";

let _supabase = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase env vars not configured (SUPABASE_URL and SUPABASE_SERVICE_KEY).");
  }
  _supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  return _supabase;
}

export const TIER_SEAT_LIMITS = {
  boutique: 10,
  growth: 25,
  enterprise: null, // custom — set explicitly per deal, not capped here
};

// Every write in this file goes through the service-role client — these
// endpoints authenticate the caller themselves (below) rather than relying
// on Postgres RLS for the mutation path, matching this codebase's existing
// pattern (spark_os_tasks, deduct-credits, update-plan all do the same).

// Verifies the request's Supabase access token belongs to an active broker,
// and returns that broker's { userId, brokerageId }. Throws on any failure
// (missing/invalid token, not a broker, no brokerage) so callers can just
// try/catch and return 401/403 without duplicating checks.
export async function requireBroker(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    const err = new Error("Missing Authorization bearer token");
    err.status = 401;
    throw err;
  }

  const supabase = getSupabase();
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    const err = new Error("Invalid or expired session");
    err.status = 401;
    throw err;
  }

  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id, role, brokerage_id")
    .eq("id", authData.user.id)
    .single();
  if (userError || !userRow) {
    const err = new Error("User profile not found");
    err.status = 404;
    throw err;
  }
  if (userRow.role !== "broker" || !userRow.brokerage_id) {
    const err = new Error("This action requires an active broker account");
    err.status = 403;
    throw err;
  }

  return { userId: userRow.id, brokerageId: userRow.brokerage_id, supabase };
}

export async function getBrokerage(brokerageId) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("brokerages").select("*").eq("id", brokerageId).single();
  if (error) throw new Error(`Failed to load brokerage: ${error.message}`);
  return data;
}

// Note: active_seats is now a stored column on `brokerages` (kept in sync
// via increment_active_seats/decrement_active_seats below), not derived by
// counting — this changed in the 20260730000000 migration at the caller's
// explicit request. listBrokerageMembers() below is still the source of
// truth for the actual roster; if the two ever disagree, that's a real bug
// worth investigating rather than silently trusting whichever is newer.
export async function listBrokerageMembers(brokerageId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("id, email, role, plan, created_at")
    .eq("brokerage_id", brokerageId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to list members: ${error.message}`);
  return data;
}

export async function createInvite(brokerageId, createdByUserId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("brokerage_invites")
    .insert({ brokerage_id: brokerageId, created_by: createdByUserId })
    .select("token, expires_at")
    .single();
  if (error) throw new Error(`Failed to create invite: ${error.message}`);
  return data;
}

export async function revokeMemberAccess(brokerageId, targetUserId) {
  const supabase = getSupabase();
  // Scope the update to this brokerage explicitly — without the
  // .eq("brokerage_id", ...) guard, a broker could pass an arbitrary
  // userId and revoke a member of a *different* brokerage.
  const { data, error } = await supabase
    .from("users")
    .update({ brokerage_id: null })
    .eq("id", targetUserId)
    .eq("brokerage_id", brokerageId)
    .select("id, email")
    .single();
  if (error) throw new Error(`Failed to revoke access: ${error.message}`);
  if (!data) throw new Error("User not found in this brokerage — nothing revoked");

  const { error: seatError } = await supabase.rpc("decrement_active_seats", { target_brokerage_id: brokerageId });
  if (seatError) {
    // The revoke itself already succeeded (the user is out) — a failed
    // counter decrement shouldn't be reported as a failed revoke, but it
    // does mean active_seats can now read one high until reconciled.
    console.error(`decrement_active_seats failed for brokerage ${brokerageId}:`, seatError.message);
  }

  return data;
}

export async function acceptInvite(token, userId) {
  const supabase = getSupabase();
  const { data: invite, error: inviteError } = await supabase
    .from("brokerage_invites")
    .select("id, brokerage_id, expires_at, used_by")
    .eq("token", token)
    .single();
  if (inviteError || !invite) throw new Error("Invite not found or invalid");
  if (invite.used_by) throw new Error("This invite has already been used");
  if (new Date(invite.expires_at) < new Date()) throw new Error("This invite has expired");

  const brokerage = await getBrokerage(invite.brokerage_id);
  if (brokerage.pilot_seat_limit != null && brokerage.active_seats >= brokerage.pilot_seat_limit) {
    throw new Error("This brokerage has no seats remaining — ask your broker to upgrade their tier.");
  }

  const { error: updateUserError } = await supabase
    .from("users")
    .update({ brokerage_id: invite.brokerage_id, role: "agent" })
    .eq("id", userId);
  if (updateUserError) throw new Error(`Failed to join brokerage: ${updateUserError.message}`);

  const { error: seatError } = await supabase.rpc("increment_active_seats", { target_brokerage_id: invite.brokerage_id });
  if (seatError) console.error(`increment_active_seats failed for brokerage ${invite.brokerage_id}:`, seatError.message);

  await supabase.from("brokerage_invites").update({ used_by: userId, used_at: new Date().toISOString() }).eq("id", invite.id);

  return { brokerageId: invite.brokerage_id };
}
