// Package delivery helpers: package sizes, items we don't carry, and proof photos.
// Proof photos live in the private "delivery-proof" storage bucket, in a folder per ride:
//   <ride id>/pickup-<time>.jpg   and   <ride id>/dropoff-<time>.jpg
import { supabase } from "./supabase";

export const PACKAGE_SIZES = [
  { id: "small", name: "Small", note: "Fits on a car seat, up to 20 lbs" },
  { id: "medium", name: "Medium", note: "Fits in a trunk, up to 50 lbs" },
];

export const NOT_ALLOWED = [
  "Alcohol", "Prescription drugs", "Weapons or ammunition", "Illegal drugs",
  "Fuel, chemicals or anything hazardous", "Cash", "Live animals",
];

export function isPackageRide(ride) {
  return (ride?.vehicle_type || ride?.vehicleType) === "package";
}

// Clean up what the sender typed before it is saved.
export function cleanDelivery(d) {
  const text = (v, n) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);
  const size = PACKAGE_SIZES.some((s) => s.id === d?.size) ? d.size : "small";
  return {
    size,
    contents: text(d?.contents, 120),
    recipientName: text(d?.recipientName, 80),
    recipientPhone: text(d?.recipientPhone, 20).replace(/[^\d+()\-\s]/g, ""),
    notes: text(d?.notes, 200),
    pickupLabel: text(d?.pickupLabel, 200),
    dropoffLabel: text(d?.dropoffLabel, 200),
    noProhibitedItems: !!d?.noProhibitedItems,
  };
}

export function deliveryProblem(d) {
  if (!d.contents) return "Say what's in the package.";
  if (!d.recipientName) return "Add the name of the person getting the package.";
  if (d.recipientPhone.replace(/\D/g, "").length < 10) return "Add the recipient's phone number.";
  if (!d.noProhibitedItems) return "Confirm the package has none of the items we can't carry.";
  return "";
}

// Shrinks a phone photo to about 1600px so uploads are quick on mobile data.
async function shrink(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.8));
    return blob || file;
  } catch {
    return file;
  }
}

// kind is "pickup" or "dropoff". Returns the saved path.
export async function uploadDeliveryPhoto(rideId, kind, file) {
  const photo = await shrink(file);
  const path = `${rideId}/${kind}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("delivery-proof").upload(path, photo, { contentType: "image/jpeg" });
  if (error) throw new Error("Couldn't upload the photo: " + error.message);
  return path;
}

export async function deliveryPhotoLink(path) {
  if (!path) return "";
  const { data } = await supabase.storage.from("delivery-proof").createSignedUrl(path, 3600);
  return data?.signedUrl || "";
}
