
// Pulls real AMBER Alerts (issued by law enforcement as "Child Abduction
// Emergency" messages, relayed through the National Weather Service into
// the federal IPAWS alert system) for Texas and its neighboring states.
// No API key required — this is a free, official government feed.

const STATES = ["TX", "OK", "AR", "LA", "NM"];

export async function GET() {
  try {
    const res = await fetch(
      `https://api.weather.gov/alerts/active?area=${STATES.join(",")}`,
      {
        headers: {
          "User-Agent": "EncompassRideshare (support@encompassrs.com)",
          Accept: "application/geo+json",
        },
        next: { revalidate: 60 },
      }
    );
    if (!res.ok) return Response.json({ alerts: [] });
    const data = await res.json();
    const alerts = (data.features || [])
      .filter((f) => f.properties?.event === "Child Abduction Emergency")
      .map((f) => ({
        id: f.id,
        headline: f.properties.headline,
        description: f.properties.description,
        areaDesc: f.properties.areaDesc,
        sent: f.properties.sent,
      }));
    return Response.json({ alerts });
  } catch (e) {
    return Response.json({ alerts: [] });
  }
}
