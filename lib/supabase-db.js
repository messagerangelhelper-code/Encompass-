// ---------- Family Hub ----------
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
export async function getMemberRideActivity(uid) {
  const { data: asRider } = await supabase.from("rides").select("*")
    .eq("rider_uid", uid).order("created_at", { ascending: false }).limit(20);
  const { data: asDriver } = await supabase.from("rides").select("*")
    .eq("driver_uid", uid).eq("status", "completed")
    .order("created_at", { ascending: false }).limit(20);

  const riderRides = (asRider || []).map((r) => ({ id: r.id, ...r, memberRole: "rider", createdAt: r.created_at ? new Date(r.created_at).getTime() : null }));
  const driverRides = (asDriver || []).map((r) => ({ id: r.id, ...r, memberRole: "driver", createdAt: r.created_at ? new Date(r.created_at).getTime() : null }));
  return [...riderRides, ...driverRides].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function subscribeToActiveAnnouncements(onChange) {
  const fetch = () => {
    supabase.from("announcements").select("*")
      .eq("active", true).order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) onChange(data.map((a) => ({ id: a.id, text: a.message, createdAt: a.created_at ? new Date(a.created_at).getTime() : null })));
      });
  };
  fetch();
  const channel = supabase
    .channel("active-announcements")
    .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, fetch)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ---------- Job board ----------
export async function createJobPost({ postedByName, postedByUid, pickup, dropoff, price, vehicleType }) {
  const { error } = await supabase.from("job_posts").insert({
    posted_by_name: postedByName,
    posted_by_uid: postedByUid,
    pickup,
    dropoff,
    price,
    vehicle_type: vehicleType,
    claimed: false,
  });
  if (error) throw error;
}

export function subscribeToOpenJobPosts(onChange) {
  const fetch = () => {
    supabase.from("job_posts").select("*").eq("claimed", false)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) onChange(data.map((j) => ({
          id: j.id,
          postedByName: j.posted_by_name,
          postedByUid: j.posted_by_uid,
          pickup: j.pickup,
          dropoff: j.dropoff,
          price: j.price,
          vehicleType: j.vehicle_type,
        })));
      });
  };
  fetch();
  const channel = supabase
    .channel("open-job-posts")
    .on("postgres_changes", { event: "*", schema: "public", table: "job_posts" }, fetch)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function claimJobPost(jobId, claimedByName, claimedByUid) {
  const { error } = await supabase.from("job_posts").update({
    claimed: true,
    claimed_by_uid: claimedByUid,
    claimed_by_name: claimedByName,
    claimed_at: new Date().toISOString(),
  }).eq("id", jobId);
  if (error) throw error;
}

// ---------- Pending bookings (Square payment confirmation) ----------
export async function getPendingBooking(token) {
  const { data, error } = await supabase
    .from('pending_bookings')
    .select('*')
    .eq('token', token)
    .single();
  if (error) return null;
  return data;
}

// ---------- Admin data reset ----------
export async function resetAllDriv
