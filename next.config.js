/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Applies to every route. Stops the site from being loaded inside
        // someone else's <iframe> (a common trick for cloned/lookalike
        // sites that wrap the real app to skim logins or payments), and
        // adds a couple of other low-cost hardening headers.
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
