// ---------- Family Groups ----------
function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createFamily(person) {
  const inviteCode = generateInviteCode();
  const { data, error } = await supabase
    .from("families")
    .insert({
      invite_code: inviteCode,
      member_uids: [person.uid],
      roles: { [person.uid]: "guardian" },
      created_by: person.uid,
    })
    .select()
    .single();
  if (error) throw error;

  await supabase.from("family_profiles").update({ family_id: data.id }).eq("id", person.uid);

  return { id: data.id, inviteCode: data.invite_code, memberUids: data.member_uids, roles: data.roles };
}

export async function joinFamily(person, code) {
  const { data: family, error: findError } = await supabase
    .from("families")
    .select("*")
    .eq("invite_code", code.trim().toUpperCase())
    .single();
  if (findError || !family) throw new Error("Invalid invite code.");

  const updatedUids = [...new Set([...family.member_uids, person.uid])];
  const updatedRoles = { ...family.roles, [person.uid]: family.roles[person.uid] || "member" };

  const { data, error } = await supabase
    .from("families")
    .update({ member_uids: updatedUids, roles: updatedRoles })
    .eq("id", family.id)
    .select()
    .single();
  if (error) throw error;

  await supabase.from("family_profiles").update({ family_id: data.id }).eq("id", person.uid);

  return { id: data.id, inviteCode: data.invite_code, memberUids: data.member_uids, roles: data.roles };
}

export function subscribeToFamily(familyId, onChange) {
  const fetch = () => {
    supabase.from("families").select("*").eq("id", familyId).single()
      .then(({ data }) => {
        if (data) onChange({ id: data.id, inviteCode: data.invite_code, memberUids: data.member_uids, roles: data.roles });
      });
  };
  fetch();
  const channel = supabase
    .channel(`family-${familyId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "families", filter: `id=eq.${familyId}` }, fetch)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function leaveFamily(person, familyId) {
  const { data: family, error: findError } = await supabase
    .from("families").select("*").eq("id", familyId).single();
  if (findError || !family) throw new Error("Family not found.");

  const updatedUids = family.member_uids.filter((uid) => uid !== person.uid);
  const updatedRoles = { ...family.roles };
  delete updatedRoles[person.uid];

  const { error } = await supabase
    .from("families")
    .update({ member_uids: updatedUids, roles: updatedRoles })
    .eq("id", familyId);
  if (error) throw error;

  await supabase.from("family_profiles").update({ family_id: null }).eq("id", person.uid);
}

export async function getFamilyMembers(memberUids) {
  if (!memberUids?.length) return [];
  const { data, error } = await supabase
    .from("family_profiles").select("*").in("id", memberUids);
  if (error) throw error;
  return data.map((m) => ({ uid: m.id, ...m }));
}

export async function removeFamilyMember(familyId, uidToRemove) {
  const { data: family, error: findError } = await supabase
    .from("families").select("*").eq("id", familyId).single();
  if (findError || !family) throw new Error("Family not found.");

  const updatedUids = family.member_uids.filter((uid) => uid !== uidToRemove);
  const updatedRoles = { ...family.roles };
  delete updatedRoles[uidToRemove];

  const { error } = await supabase
    .from("families")
    .update({ member_uids: updatedUids, roles: updatedRoles })
    .eq("id", familyId);
  if (error) throw error;

  await supabase.from("family_profiles").update({ family_id: null }).eq("id", uidToRemove);
}

// ---------- Family activity & announcements ----------
export async function getMemberRideActivity(memberUids, max = 50) {
  if (!memberUids?.length) return [];
  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .in("rider_uid", memberUids)
    .order("created_at", { ascending: false })
    .limit(max);
  if (error) throw error;
  return data.map((r) => ({ id: r.id, ...r }));
}

export function subscribeToActiveAnnouncements(onChange) {
  const fetch = () => {
    supabase.from("announcements").select("*").eq("active", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) onChange(data); });
  };
  fetch();
  const channel = supabase
    .channel("active-announcements")
    .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, fetch)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ---------- Job board ----------
export async function createJobPost(person, { title, description, pay }) {
  const { error } = await supabase.from("job_posts").insert({
    title, description, pay, posted_by: person.uid, status: "open",
  });
  if (error) throw error;
}

export function subscribeToOpenJobPosts(onChange) {
  const fetch = () => {
    supabase.from("job_posts").select("*").eq("status", "open")
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) onChange(data); });
  };
  fetch();
  const channel = supabase
    .channel("open-job-posts")
    .on("postgres_changes", { event: "*", schema: "public", table: "job_posts" }, fetch)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function claimJobPost(jobId, person) {
  const { error } = await supabase
    .from("job_posts")
    .update({ status: "claimed", claimed_by: person.uid })
    .eq("id", jobId)
    .eq("status", "open");
  if (error) throw error;
}
