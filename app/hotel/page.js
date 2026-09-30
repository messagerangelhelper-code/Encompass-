// This file is what actually makes /hotel a real, reachable page — it
// just renders the HotelPortal component that already lives in
// app/hotels.js (booking form, Square payment, and the sandboxed demo
// mode). Without a page.js in this folder, Next.js has nothing to serve
// at this URL even though hotels.js itself is correct.
export { default } from "../hotels";
