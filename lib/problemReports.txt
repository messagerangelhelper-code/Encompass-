// "Report a problem" for riders and drivers, and the Admin side of it.
// Table: public.problem_reports (see supabase/problem-reports.sql).
import { supabase } from "./supabase";

export const PROBLEM_CATEGORIES = {
  rider: [
    "Safety concern",
    "Driver behavior",
    "Charged wrong / refund",
    "Lost item",
    "Package problem",
    "App not working",
    "Something else",
  ],
  driver: [
    "Safety concern",
    "Rider behavior",
    "Pay or payout problem",
    "Package problem",
    "Map or navigation",
    "App not working",
    "Something else",
  ],
};

export async function sendProblemReport({ role, user, rideId, category, message }) {
  const text = String(message || "").replace(/\s+/g, " ").trim().slice(0, 1000);
  if (!text) throw new Error("Tell us what happened.");
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) throw new Error("Sign in again, then send your report.");
  const { error } = await supabase.from("problem_reports").insert({
    reporter_uid: uid,
    reporter_role: role === "driver" ? "driver" : "rider",
    reporter_name: String(user?.name || "").slice(0, 80) || null,
    reporter_email: session.user.email || user?.email || null,
    ride_id: rideId ? String(rideId) : null,
    category: String(category || "Something else").slice(0, 60),
    message: text,
  });
  if (error) throw new Error("Couldn't send your report: " + error.message);
}

export async function myProblemReports() {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return [];
  const { data } = await supabase
    .from("problem_reports").select("*")
    .eq("reporter_uid", uid)
    .order("created_at", { ascending: false })
    .limit(20);
  return data || [];
}

// ---------- Admin ----------
export function subscribeToProblemReports(onChange) {
  const fetch = () => {
    supabase.from("problem_reports").select("*")
      .order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => { if (data) onChange(data); });
  };
  fetch();
  const channel = supabase
    .channel("admin-problem-reports")
    .on("postgres_changes", { event: "*", schema: "public", table: "problem_reports" }, fetch)
    .subscribe();
  // Backup check in case the live connection drops.
  const timer = setInterval(fetch, 30000);
  return () => { clearInterval(timer); supabase.removeChannel(channel); };
}

export async function markProblemSeen(id) {
  const { error } = await supabase.from("problem_reports")
    .update({ seen_at: new Date().toISOString() }).eq("id", id).is("seen_at", null);
  if (error) throw error;
}

export async function answerProblemReport(id, { reply, resolve }) {
  const patch = { seen_at: new Date().toISOString() };
  if (reply !== undefined) patch.admin_reply = String(reply || "").trim().slice(0, 1000) || null;
  if (resolve) { patch.status = "resolved"; patch.resolved_at = new Date().toISOString(); }
  const { error } = await supabase.from("problem_reports").update(patch).eq("id", id);
  if (error) throw error;
}

export async function reopenProblemReport(id) {
  const { error } = await supabase.from("problem_reports")
    .update({ status: "open", resolved_at: null }).eq("id", id);
  if (error) throw error;
}
