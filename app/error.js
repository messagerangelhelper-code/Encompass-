'use client';

export default function Error({ error, reset }) {
  return (
    <div style={{ padding: 20, color: '#fff', background: '#111318', minHeight: '100vh' }}>
      <h2 style={{ color: '#ff6b6b', marginBottom: 10 }}>Something went wrong:</h2>
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{error?.message}</pre>
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 10, color: '#999', marginTop: 10 }}>{error?.stack}</pre>
      <button
        onClick={reset}
        style={{ marginTop: 20, padding: '10px 20px', background: '#6C5CE7', color: '#fff', borderRadius: 8 }}
      >
        Try again
      </button>
    </div>
  );
}
