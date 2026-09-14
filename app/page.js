'use client';

import { useState } from 'react';
import CityMap from './CityMap';
import LiveTrackingMap from './LiveTrackingMap';
import HowToBookModal from './HowToBookModal';
import ChatPanel from './ChatPanel';

export const dynamic = 'force-dynamic';

function ErrorDisplay({ error }) {
  return (
    <div style={{ padding: 20, color: '#fff', background: '#111318', minHeight: '100vh' }}>
      <h2 style={{ color: '#ff6b6b', marginBottom: 10 }}>Client Error:</h2>
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{error?.message}</pre>
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 10, color: '#999', marginTop: 10 }}>{error?.stack}</pre>
    </div>
  );
}

export default function HomePage() {
  const [rideBooked, setRideBooked] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [error, setError] = useState(null);

  if (error) return <ErrorDisplay error={error} />;

  try {
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
  } catch (err) {
    setError(err);
    return null;
  }
}
