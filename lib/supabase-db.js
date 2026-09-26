// ---------- Family Hub ----------
import { supabase } from "./supabase";
function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
// ---------- Site Settings ----------
export async function getSiteSettings() {
  const { data, error } = await supabase.from("site_settings").select("*").eq("id", 1).single();
  if (error) return { site_enabled: true };
  return data;
}

// ---------- Shared auth ----------
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ---------- Driver auth (magic link) ----------
export async function sendMagicLinkDriver(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/driver` },
  });
  if (error) throw error;
}

export async function completeMagicLinkSignInDriver() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) return null;

  const uid = session.user.id;
  const email = session.user.email;

  const { data: existing } = await supabase.from("drivers").select("*").eq("id", uid).single();
  if (existing) {
    return {
      uid, email, name: existing.name,
      carModel: existing.car_model, plate: existing.plate, phone: existing.phone,
      vehicleType: existing.vehicle_type, audioRecordingEnabled: existing.audio_recording_enabled,
      videoRecordingEnabled: existing.video_recording_enabled, earningsToday: existing.earnings_today,
      backgroundCheckStatus: existing.background_check_status, pendingApproval: existing.pending_approval,
      rating: existing.rating, mpg: existing.mpg, gasPrice: existing.gas_price,
    };
  }
  return { uid, email, needsVehicleInfo: true, name: email.split("@")[0] };
  }
export async function completeDriverMagicLinkSignup(uid, { name, email, carModel, plate, vehicleType, phone }) {
  const row = {
    id: uid, name, email, car_model: carModel, plate, vehicle_type: vehicleType, phone,
    earnings_today: 0, rating: 5.0, rating_count: 0,
    pending_approval: false, background_check_status: "pending",
    audio_recording_enabled: false, video_recording_enabled: false,
    created_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("drivers").insert(row);
  if (error) throw error;
  return { uid, name, email, carModel, plate, vehicleType, phone, earningsToday: 0, rating: 5.0, audioRecordingEnabled: false, videoRecordingEnabled: false, backgroundCheckStatus: "pending", pendingApproval: false };
}

// ---------- Driver profile ----------
export async function updateDriverProfile(uid, fields) {
  const map = {
    carModel: "car_model", vehicleType: "vehicle_type", earningsToday: "earnings_today",
    audioRecordingEnabled: "audio_recording_enabled", videoRecordingEnabled: "video_recording_enabled",
    backgroundCheckStatus: "background_check_status",} pendingApproval: "pending_approval",
    gasPrice: "gas_price",
  };
  const payload = {};
  for (const [k, v] of Object.entries(fields)) payload[map[k] || k] = v;
  const { error } = await supabase.from("drivers").update(payload).eq("id", uid);
  if (error) throw error;
}

export async function setDriverOnlineStatus(uid, isOnline) {
  const { error } = await supabase.from("drivers").update({ is_online: isOnline }).eq("id", uid);
  if (error) throw error;
}

export async function updateDriverLocation(rideId, lat, lng) {
  const { error } = await supabase.from("rides").update({ driver_location: { lat, lng } }).eq("id", rideId);
  if (error) throw error;
}

// ---------- Rides ----------
export async function createRide({ riderUid, riderName, destination, fare, miles, minutes, vehicleType, pickupLocation, dropoffLocation }) {
  const { data, error } = await supabase.from("rides").insert({
    rider_uid: riderUid, rider_name: riderName, destination, fare, miles, minutes,
    vehicle_type: vehicleType, pickup_location: pickupLocation, dropoff_location: dropoffLocation,
    status: "requested", created_at: new Date().toISOString(),
  }).select().single();
  if (error) throw error;
  return data.id;
}

export function subscribeToRide(rideId, onChange) {
  const fetch = () => {
    supabase.from("rides").select("*").eq("id", rideId).single()
      .then(({ data }) => { if (data) onChange(data); });
  };
  fetch();
  const channel = supabase.channel(`ride-${rideId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "rides", filter: `id=eq.${rideId}` }, fetch)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export function subscribeToNextPendingRide(vehicleType, onChange) {
  const fetch = () => {
    supabase.from("rides").select("*")
      .eq("status", "requested").eq("vehicle_type", vehicleType)
      .order("created_at", { ascending: true }).limit(1)
      .then(({ data }) => { if (data && data[0]) onChange(data[0]); });
  };
  const channel = supabase.channel(`pending-rides-${vehicleType}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "rides" }, fetch)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
// ---------- Ride Chat Messages ----------
export async function appendRideMessage(rideId, sender, message) {
  const { data: ride, error: fetchError } = await supabase
    .from("rides")
    .select("messages")
    .eq("id", rideId)
    .single();
  if (fetchError) throw fetchError;

  const newMessage = {
    sender,
    message,
    created_at: new Date().toISOString(),
  };
  const updatedMessages = [...(ride.messages || []), newMessage];

  const { error } = await supabase
    .from("rides")
    .update({ messages: updatedMessages })
    .eq("id", rideId);
  if (error) throw error;
}

export function subscribeToRideMessages(rideId, onChange) {
  const fetch = () => {
    supabase.from("rides").select("messages").eq("id", rideId).single()
      .then(({ data }) => {
        if (data) onChange(data.messages || []);
      });
  };
  fetch();
  const channel = supabase
    .channel(`ride-messages-${rideId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides", filter: `id=eq.${rideId}` }, fetch)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
export async function updateRide(rideId, fields) {
  const map = { driverUid: "driver_uid", driverName: "driver_name", carModel: "car_model", driverRecording: "driver_recording" };
  const payload = {};
  for (const [k, v] of Object.entries(fields)) payload[map[k] || k] = v;
  const { error } = await supabase.from("rides").update(payload).eq("id", rideId);
  if (error) throw error;
}

export function subscribeToDriverRides(uid, onChange) {
  const fetch = () => {
    supabase.from("rides").select("*").eq("driver_uid", uid).eq("status", "completed")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) onChange(data.map((r) => ({ id: r.id, ...r, createdAt: r.created_at ? new Date(r.created_at).getTime() : null })));
      });
  };
  fetch();
  const channel = supabase.channel(`driver-rides-${uid}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "rides", filter: `driver_uid=eq.${uid}` }, fetch)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ---------- Ratings ----------
export async function rateDriver(rideId, driverUid, stars) {
  const { data: d } = await supabase.from("drivers").select("rating, rating_count").eq("id", driverUid).single();
  const count = (d?.rating_count || 0) + 1;
  const newRating = ((d?.rating || 5) * (count - 1) + stars) / count;
  await supabase.from("drivers").update({ rating: newRating, rating_count: count }).eq("id", driverUid);
  await supabase.from("rides").update({ driver_rated: true }).eq("id", rideId);
}

export async function rateRider(rideId, riderUid, stars) {
  const { data: r } = await supabase.from("riders").select("rating, rating_count").eq("id", riderUid).single();
  const count = (r?.rating_count || 0) + 1;
  const newRating = ((r?.rating || 5) * (count - 1) + stars) / count;
  await supabase.from("riders").update({ rating: newRating, rating_count: count }).eq("id", riderUid);
  await supabase.from("rides").update({ rider_rated: true }).eq("id", rideId);
}
// ---------- Rider auth (magic link) ----------
export async function sendMagicLinkRider(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/rider`,
    },
  });
  if (error) throw error;
}

export async function completeMagicLinkSignInRider() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) return null;

  const uid = session.user.id;
  const email = session.user.email;

  const { data: existing } = await supabase
    .from("riders")
    .select("*")
    .eq("id", uid)
    .single();

  if (existing) {
    return { uid, ...existing };
  }

  const profile = {
    id: uid,
    name: email.split("@")[0],
    email,
    audio_recording_enabled: false,
    rating: 5.0,
    rating_count: 0,
    created_at: new Date().toISOString(),
  };
  const { error: insertError } = await supabase.from("riders").insert(profile);
  if (insertError) throw insertError;

  return { uid, ...profile };
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
export async function resetAllDriverEarnings() {
  const { error } = await supabase
    .from('drivers')
    .update({ earnings_today: 0 })
    .neq('id', '');
  if (error) throw error;
}

export async function deleteAllRides() {
  const { error: msgError } = await supabase.from('ride_messages').delete().neq('id', '');
  if (msgError) throw msgError;
  const { error } = await supabase.from('rides').delete().neq('id', '');
  if (error) throw error;
}
