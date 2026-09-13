import { supabase } from "./supabase";

// ---------- Site Settings ----------
export async function getSiteSettings() {
  const { data, error } = await supabase
    .from('site_settings')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) return { site_enabled: true }; // fail open so a glitch doesn't lock everyone out
  return data;
}

export async function setSiteEnabled(enabled) {
  const { error } = await supabase
    .from('site_settings')
    .update({ site_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) throw error;
}

// ---------- Rider Auth ----------
export async function signUpRider({ name, email, password }) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  const profile = {
    id: data.user.id, name, email,
    audio_recording_enabled: false, rating: 5.0, rating_count: 0,
    created_at: new Date().toISOString(),
  };
  const { error: insertError } = await supabase.from("riders").insert(profile);
  if (insertError) throw insertError;
  return { uid: data.user.id, ...profile };
}

export async function loginRider({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const { data: profile, error: profileError } = await supabase
    .from("riders").select("*").eq("id", data.user.id).single();
  if (profileError) throw new Error("No rider profile found for this account.");
  return { uid: data.user.id, ...profile };
}

// ---------- Admin Auth ----------
const ADMIN_EMAILS = [
  "integrityrecordsadmin@proton.me",
];

export async function loginAdmin({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!ADMIN_EMAILS.includes(email.trim().toLowerCase())) {
    await supabase.auth.signOut();
    throw new Error("This account is not authorized for admin access.");
  }
  return { uid: data.user.id, email: data.user.email };
}

// ---------- Driver Auth ----------
export async function signUpDriver({ name, email, password, carModel, plate, vehicleType }) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;

  // Create the driver's Stripe Connect account so they can receive payouts
  let stripeAccountId = null;
  try {
    const res = await fetch("/api/create-connected-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const stripeData = await res.json();
    if (res.ok) {
      stripeAccountId = stripeData.accountId;
    } else {
      console.error("Stripe account creation failed:", stripeData.error?.message);
    }
  } catch (err) {
    console.error("Stripe account creation request failed:", err.message);
  }

  const profile = {
    id: data.user.id, name, email, car_model: carModel, plate,
    vehicle_type: vehicleType || "standard", rating: 5.0, earnings_today: 0,
    audio_recording_enabled: false, background_check_status: "pending",
    documents_status: "not_submitted", documents: {}, pending_approval: true,
    stripe_account_id: stripeAccountId,
    created_at: new Date().toISOString(),
  };
  const { error: insertError } = await supabase.from("drivers").insert(profile);
  if (insertError) throw insertError;
  return { uid: data.user.id, ...profile };
}

export async function loginDriver({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const { data: profile, error: profileError } = await supabase
    .from("drivers").select("*").eq("id", data.user.id).single();
  if (profileError) throw new Error("No driver profile found for this account.");
  return { uid: data.user.id, ...profile };
}

// ---------- Family Auth ----------
export async function signUpFamily({ name, email, password }) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  const profile = { id: data.user.id, name, email, created_at: new Date().toISOString() };
  const { error: insertError } = await supabase.from("family_profiles").insert(profile);
  if (insertError) throw insertError;
  return { uid: data.user.id, ...profile };
}

export async function loginFamily({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const { data: profile, error: profileError } = await supabase
    .from("family_profiles").select("*").eq("id", data.user.id).single();
  if (!profile) {
    const newProfile = { id: data.user.id, name: email.split("@")[0], email, created_at: new Date().toISOString() };
    await supabase.from("family_profiles").insert(newProfile);
    return { uid: data.user.id, ...newProfile };
  }
  return { uid: data.user.id, ...profile };
}

// ---------- Shared ----------
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email, redirectPath = "/") {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}${redirectPath}`,
  });
  if (error) throw error;
}

// ---------- Google Sign-In ----------
// NOTE: the Google sign-in button was removed from the UI (iOS Safari redirect
// issues), but completeGoogleSignInRider/Driver/Family are still imported and
// used by the magic-link flow below (same "check session, build profile" logic
// is shared by both). Left in place intentionally — do not remove.
export async function startGoogleSignIn(redirectPath = "/rider") {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}${redirectPath}` },
  });
  if (error) throw error;
}

export async function completeGoogleSignInRider() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const uid = session.user.id;
  const { data: profile } = await supabase.from("riders").select("*").eq("id", uid).single();
  if (profile) return { uid, ...profile };
  const newProfile = {
    id: uid, name: session.user.user_metadata?.full_name || "Rider",
    email: session.user.email, audio_recording_enabled: false,
    rating: 5.0, rating_count: 0, created_at: new Date().toISOString(),
  };
  await supabase.from("riders").insert(newProfile);
  return { uid, ...newProfile };
}

export async function completeGoogleSignInDriver() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const uid = session.user.id;
  const { data: profile } = await supabase.from("drivers").select("*").eq("id", uid).single();
  if (profile) return { uid, ...profile, needsVehicleInfo: false };
  return {
    uid, needsVehicleInfo: true,
    name: session.user.user_metadata?.full_name || "Driver",
    email: session.user.email,
  };
}

export async function completeGoogleSignInFamily() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const uid = session.user.id;
  const { data: profile } = await supabase.from("family_profiles").select("*").eq("id", uid).single();
  if (profile) return { uid, ...profile };
  const newProfile = {
    id: uid, name: session.user.user_metadata?.full_name || "Family",
    email: session.user.email, created_at: new Date().toISOString(),
  };
  await supabase.from("family_profiles").insert(newProfile);
  return { uid, ...newProfile };
}

// Creates a driver's profile row after they finish the vehicle-info step —
// used by both the (currently unused) Google sign-up path and the magic-link
// sign-up path below. Renamed from completeDriverGoogleSignup for clarity,
// since magic link is now the only flow that actually calls it.
export async function completeDriverProfileSetup(uid, { name, email, carModel, plate, vehicleType }) {
  const profile = {
    id: uid, name, email, car_model: carModel, plate,
    vehicle_type: vehicleType || "standard", rating: 5.0, earnings_today: 0,
    audio_recording_enabled: false, background_check_status: "pending",
    documents_status: "not_submitted", documents: {}, pending_approval: true,
    created_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("drivers").insert(profile);
  if (error) throw error;
  return { uid, ...profile };
}

// ---------- Magic Link (passwordless) ----------
export async function sendMagicLinkRider(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email, options: { emailRedirectTo: `${window.location.origin}/rider` },
  });
  if (error) throw error;
}

export async function sendMagicLinkDriver(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email, options: { emailRedirectTo: `${window.location.origin}/driver` },
  });
  if (error) throw error;
}

export async function sendMagicLinkFamily(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email, options: { emailRedirectTo: `${window.location.origin}/family` },
  });
  if (error) throw error;
}

// Supabase handles the magic-link session automatically on page load —
// these just check for an existing session and fetch/create the profile,
// same pattern as the Google functions above.
export async function completeMagicLinkSignInRider() {
  return completeGoogleSignInRider();
}
export async function completeMagicLinkSignInDriver() {
  return completeGoogleSignInDriver();
}
export async function completeMagicLinkSignInFamily() {
  return completeGoogleSignInFamily();
}

// Called after a new driver fills out the vehicle-info form post-magic-link.
// FIX: this was previously (incorrectly) aliased to completeMagicLinkSignInDriver,
// which takes no arguments and just re-checks for an existing profile — so new
// drivers' submitted info was silently discarded, looping them back to the same
// form. Now correctly points to the function that actually saves their profile.
export const completeDriverMagicLinkSignup = completeDriverProfileSetup;

// ---------- Rides ----------
export async function createRide(ride) {
  const { data, error } = await supabase
    .from("rides")
    .insert({
      rider_uid: ride.riderUid,
      rider_name: ride.riderName,
      destination: ride.destination,
      vehicle_type: ride.vehicleType || "standard",
      fare: ride.fare,
      miles: ride.miles,
      minutes: ride.minutes,
      is_family_ride: ride.isFamilyRide || false,
      rider_recording: ride.riderRecording || false,
      payment_method: ride.paymentMethod || "card",
      pickup_location: ride.pickupLocation || null,
      dropoff_location: ride.dropoffLocation || null,
      status: "requested",
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateRide(rideId, patch) {
  // Convert camelCase keys to snake_case for Postgres columns
  const snakePatch = {};
  for (const [key, value] of Object.entries(patch)) {
    const snakeKey = key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
    snakePatch[snakeKey] = value;
  }
  const { error } = await supabase.from("rides").update(snakePatch).eq("id", rideId);
  if (error) throw error;
}

export function subscribeToRide(rideId, onChange) {
  // Initial fetch
  supabase.from("rides").select("*").eq("id", rideId).single()
    .then(({ data }) => { if (data) onChange({ id: data.id, ...data }); });

  // Realtime subscription for changes
  const channel = supabase
    .channel(`ride-${rideId}`)
    .on("postgres_changes",
      { event: "UPDATE", schema: "public", table: "rides", filter: `id=eq.${rideId}` },
      (payload) => onChange({ id: payload.new.id, ...payload.new })
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export function subscribeToNextPendingRide(vehicleType, onRide) {
  const channel = supabase
    .channel("pending-rides")
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "rides",
        filter: `vehicle_type=eq.${vehicleType || "standard"}` },
      (payload) => {
        if (payload.new.status === "requested") onRide({ id: payload.new.id, ...payload.new });
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export function subscribeToAllRides(onChange, max = 100) {
  supabase.from("rides").select("*").order("created_at", { ascending: false }).limit(max)
    .then(({ data }) => { if (data) onChange(data.map((r) => ({ id: r.id, ...r }))); });

  const channel = supabase
    .channel("all-rides")
    .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => {
      supabase.from("rides").select("*").order("created_at", { ascending: false }).limit(max)
        .then(({ data }) => { if (data) onChange(data.map((r) => ({ id: r.id, ...r }))); });
    })
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export function subscribeToDriverRides(driverUid, onChange, max = 300) {
  const fetch = () => {
    supabase.from("rides").select("*")
      .eq("driver_uid", driverUid).eq("status", "completed")
      .order("created_at", { ascending: false }).limit(max)
      .then(({ data }) => { if (data) onChange(data.map((r) => ({ id: r.id, ...r }))); });
  };
  fetch();
  const channel = supabase
    .channel(`driver-rides-${driverUid}`)
    .on("postgres_changes",
      { event: "*", schema: "public", table: "rides", filter: `driver_uid=eq.${driverUid}` },
      fetch
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function rateDriver(rideId, driverUid, stars) {
  await supabase.from("rides").update({ driver_rating_by_rider: stars }).eq("id", rideId);
  const { data: driver } = await supabase.from("drivers").select("rating, rating_count").eq("id", driverUid).single();
  if (!driver) throw new Error("Driver not found.");
  const newCount = driver.rating_count + 1;
  const newRating = (driver.rating * driver.rating_count + stars) / newCount;
  await supabase.from("drivers").update({ rating: newRating, rating_count: newCount }).eq("id", driverUid);
}

export async function rateRider(rideId, riderUid, stars) {
  await supabase.from("rides").update({ rider_rating_by_driver: stars }).eq("id", rideId);
  const { data: rider } = await supabase.from("riders").select("rating, rating_count").eq("id", riderUid).single();
  if (!rider) throw new Error("Rider not found.");
  const newCount = rider.rating_count + 1;
  const newRating = (rider.rating * rider.rating_count + stars) / newCount;
  await supabase.from("riders").update({ rating: newRating, rating_count: newCount }).eq("id", riderUid);
}

// ---------- Ride messages ----------
export async function appendRideMessage(rideId, sender, text) {
  const { error } = await supabase.from("ride_messages").insert({
    ride_id: rideId, sender, text, created_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export function subscribeToRideMessages(rideId, onChange) {
  const fetch = () => {
    supabase.from("ride_messages").select("*").eq("ride_id", rideId)
      .order("created_at", { ascending: true })
      .then(({ data }) => { if (data) onChange(data); });
  };
  fetch();
  const channel = supabase
    .channel(`ride-messages-${rideId}`)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "ride_messages", filter: `ride_id=eq.${rideId}` },
      fetch
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ---------- Driver location (for live tracking) ----------
export async function updateDriverLocation(rideId, lat, lng) {
  const { error } = await supabase.from("rides")
    .update({ driver_location: { lat, lng, updatedAt: Date.now() } })
    .eq("id", rideId);
  if (error) throw error;
}

export function subscribeToFamilyActiveRide(memberUids, onChange) {
  if (!memberUids?.length) { onChange(null); return () => {}; }

  const fetch = () => {
    supabase.from("rides").select("*").eq("status", "in_progress")
      .order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => {
        const match = data?.find((r) => memberUids.includes(r.rider_uid));
        onChange(match ? { id: match.id, ...match, driverLocation: match.driver_location } : null);
      });
  };
  fetch();
  const channel = supabase
    .channel("family-active-ride")
    .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, fetch)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ---------- Driver Profile & Documents ----------
export async function updateDriverProfile(uid, patch) {
  const snakePatch = {};
  for (const [key, value] of Object.entries(patch)) {
    const snakeKey = key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
    snakePatch[snakeKey] = value;
  }
  const { error } = await supabase.from("drivers").update(snakePatch).eq("id", uid);
  if (error) throw error;
}

export async function updateRiderProfile(uid, patch) {
  const snakePatch = {};
  for (const [key, value] of Object.entries(patch)) {
    const snakeKey = key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
    snakePatch[snakeKey] = value;
  }
  const { error } = await supabase.from("riders").update(snakePatch).eq("id", uid);
  if (error) throw error;
}

export async function uploadDriverDocument(uid, docType, file) {
  const filePath = `driver-documents/${uid}/${docType}-${Date.now()}`;
  const { error } = await supabase.storage.from("documents").upload(filePath, file);
  if (error) throw error;
  const { data } = supabase.storage.from("documents").getPublicUrl(filePath);
  return data.publicUrl;
}

export async function submitDriverDocuments(uid, docs) {
  const { error } = await supabase.from("drivers").update({
    documents: docs, documents_status: "pending_review",
    documents_submitted_at: new Date().toISOString(),
  }).eq("id", uid);
  if (error) throw error;
}

export async function reviewDriverDocuments(uid, approved, reason) {
  const { error } = await supabase.from("drivers").update({
    documents_status: approved ? "approved" : "rejected",
    documents_rejection_reason: approved ? null : (reason || "Documents did not meet requirements."),
    documents_reviewed_at: new Date().toISOString(),
    ...(approved ? { pending_approval: false } : {}),
  }).eq("id", uid);
  if (error) throw error;
}

export async function scheduleVerificationCall(uid, { scheduledAt, zoomLink }) {
  const { error } = await supabase.from("drivers").update({
    documents_status: "call_scheduled",
    verification_call_at: scheduledAt,
    verification_zoom_link: zoomLink,
  }).eq("id", uid);
  if (error) throw error;
}

// ---------- Online status / push ----------
export async function setDriverOnlineStatus(uid, online, pushToken) {
  const patch = { online };
  if (pushToken) patch.push_token = pushToken;
  const { error } = await supabase.from("drivers").update(patch).eq("id", uid);
  if (error) throw error;
}

export async function getOnlineDriverTokens(vehicleType) {
  const { data, error } = await supabase.from("drivers").select("push_token")
    .eq("online", true).eq("vehicle_type", vehicleType || "standard");
  if (error) throw error;
  return data.filter((d) => d.push_token).map((d) => d.push_token);
}

// ---------- Subscriptions for admin dashboard ----------
export function subscribeToDrivers(onChange) {
  const fetch = () => {
    supabase.from("drivers").select("*")
      .then(({ data }) => { if (data) onChange(data.map((d) => ({ uid: d.id, ...d }))); });
  };
  fetch();
  const channel = supabase
    .channel("all-drivers")
    .on("postgres_changes", { event: "*", schema: "public", table: "drivers" }, fetch)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export function subscribeToRiders(onChange) {
  const fetch = () => {
    supabase.from("riders").select("*")
      .then(({ data }) => { if (data) onChange(data.map((r) => ({ uid: r.id, ...r }))); });
  };
  fetch();
  const channel = supabase
    .channel("all-riders")
    .on("postgres_changes", { event: "*", schema: "public", table: "riders" }, fetch)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ---------- Family Hub activity feed ----------
export async function getMemberRideActivity(uid) {
  const { data: asRider } = await supabase.from("rides").select("*")
    .eq("rider_uid", uid).order("created_at", { ascending: false }).limit(20);
  const { data: asDriver } = await supabase.from("rides").select("*")
    .eq("driver_uid", uid).eq("status", "completed")
    .order("created_at", { ascending: false }).limit(20);

  const riderRides = (asRider || []).map((r) => ({ id: r.id, ...r, memberRole: "rider" }));
  const driverRides = (asDriver || []).map((r) => ({ id: r.id, ...r, memberRole: "driver" }));
  return [...riderRides, ...driverRides].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
}

// ---------- Flat-rate plans ----------
export async function getRiderFlatratePlan(riderId) {
  const { data, error } = await supabase
    .from('flatrate_plans')
    .select('*')
    .eq('rider_id', riderId)
    .eq('active', true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function incrementFlatrateUsage(planId) {
  const todayStr = new Date().toISOString().split('T')[0];
  const { data: existing } = await supabase
    .from('flatrate_usage')
    .select('*')
    .eq('plan_id', planId)
    .eq('usage_date', todayStr)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('flatrate_usage')
      .update({ rides_used: existing.rides_used + 1 })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('flatrate_usage')
      .insert({ plan_id: planId, usage_date: todayStr, rides_used: 1 });
  }
}

export async function getPendingFlatratePlans() {
  const { data, error } = await supabase
    .from('flatrate_plans')
    .select('*, riders(name, phone)')
    .eq('status', 'pending');
  if (error) throw error;
  return data;
}

export async function approveFlatratePlan(planId, weeklyPrice) {
  const { error } = await supabase
    .from('flatrate_plans')
    .update({ weekly_price: weeklyPrice, status: 'active', active: true })
    .eq('id', planId);
  if (error) throw error;
}

export async function rejectFlatratePlan(planId) {
  const { error } = await supabase
    .from('flatrate_plans')
    .update({ status: 'rejected' })
    .eq('id', planId);
  if (error) throw error;
}

// ---------- Announcements ----------
export function subscribeToActiveAnnouncements(onChange) {
  const fetch = () => {
    supabase.from("announcements").select("*")
      .eq("active", true).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) onChange(data.map((a) => ({ id: a.id, ...a, createdAt: a.created_at ? new Date(a.created_at).getTime() : null }))); });
  };
  fetch();
  const channel = supabase
    .channel("announcements")
    .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, fetch)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function createAnnouncement({ text, createdBy }) {
  const { error } = await supabase.from("announcements").insert({
    text, created_by: createdBy, active: true, created_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function deactivateAnnouncements(id) {
  const { error } = await supabase.from("announcements").update({ active: false }).eq("id", id);
  if (error) throw error;
}

// ---------- Family Hub ----------
function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function buildFamilyShape(familyId) {
  const { data: family } = await supabase.from("families").select("*").eq("id", familyId).single();
  if (!family) return null;
  const { data: members } = await supabase.from("family_members").select("*").eq("family_id", familyId);
  const memberUids = (members || []).map((m) => m.user_id);
  const roles = {};
  (members || []).forEach((m) => { roles[m.user_id] = m.role; });
  return { id: family.id, inviteCode: family.invite_code, createdAt: family.created_at, memberUids, roles };
}

export async function createFamily(person) {
  const inviteCode = generateInviteCode();
  const { data: family, error } = await supabase.from("families")
    .insert({ invite_code: inviteCode, created_at: new Date().toISOString() })
    .select().single();
  if (error) throw error;
  await supabase.from("family_members").insert({ family_id: family.id, user_id: person.uid, role: "guardian" });
  return buildFamilyShape(family.id);
}

export async function joinFamily(person, inviteCode) {
  const { data: family, error } = await supabase.from("families")
    .select("*").eq("invite_code", inviteCode.trim().toUpperCase()).single();
  if (error || !family) throw new Error("Invalid invite code.");
  await supabase.from("family_members").insert({ family_id: family.id, user_id: person.uid, role: "member" });
  return buildFamilyShape(family.id);
}

export function subscribeToFamily(familyId, onChange) {
  const fetch = () => { buildFamilyShape(familyId).then(onChange); };
  fetch();
  const channel = supabase
    .channel(`family-${familyId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "family_members", filter: `family_id=eq.${familyId}` }, fetch)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function leaveFamily(person, familyId) {
  const { error } = await supabase.from("family_members")
    .delete().eq("family_id", familyId).eq("user_id", person.uid);
  if (error) throw error;
}

export async function removeFamilyMember(familyId, targetUid) {
  const { error } = await supabase.from("family_members")
    .delete().eq("family_id", familyId).eq("user_id", targetUid);
  if (error) throw error;
}

export async function getFamilyMembers(memberUids) {
  if (!memberUids?.length) return [];
  const { data, error } = await supabase.from("family_profiles").select("*").in("id", memberUids);
  if (error) throw error;
  return data.map((p) => ({ uid: p.id, ...p }));
}

// ---------- Job Board ----------
export async function createJobPost({ postedByName, postedByUid, pickup, dropoff, price, vehicleType }) {
  const { error } = await supabase.from("job_posts").insert({
    posted_by_uid: postedByUid,
    posted_by_name: postedByName,
    pickup, dropoff, price,
    vehicle_type: vehicleType,
    claimed: false,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export function subscribeToOpenJobPosts(onChange) {
  const fetch = () => {
    supabase.from("job_posts").select("*")
      .eq("claimed", false)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) onChange(data.map((j) => ({
          id: j.id,
          postedByUid: j.posted_by_uid,
          postedByName: j.posted_by_name,
          pickup: j.pickup,
          dropoff: j.dropoff,
          price: j.price,
          vehicleType: j.vehicle_type,
        })));
      });
  };
  fetch();
  const channel = supabase
    .channel("job-posts")
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
