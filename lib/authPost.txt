// Browser helper: POST JSON to our own API with the signed-in user's token.
import { supabase } from "./supabase";

export async function authPost(url, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
    },
    body: JSON.stringify(body || {}),
  });
  return res.json();
}
