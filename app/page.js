'use client';

import { useState } from 'react';
import CityMap from './CityMap';
import LiveTrackingMap from './LiveTrackingMap';
import HowToBookModal from './HowToBookModal';
import ChatPanel from './ChatPanel';
export const dynamic = 'force-dynamic';
export default function HomePage() {
  const [rideBooked, setRideBooked] = useState(false);
  const [showChat, setShowChat] = useState(false);

  return (
    <main className="relative w-full h-screen bg-[#111318]">
      <CityMap />

      {rideBooked && <LiveTrackingMap />}

      {!rideBooked && (
        <HowToBookModal onBook={() => setRideBooked(true)} />
      )}

      {rideBooked && showChat && <ChatPanel />}
    </main>
  );
}
