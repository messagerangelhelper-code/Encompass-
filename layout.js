
export const dynamic = "force-dynamic";
import "./globals.css";

export const metadata = {
  title: "Rideshare",
  description: "Rider, driver, and admin apps",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#111318",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name='impact-site-verification' value='10831d29-ca06-4aa3-a00b-3a6ee9bbe34b' />
        <meta name='impact-site-verification' value='234742ee-e9a4-41a5-8961-f41ff4e670e7' />
      </head>
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
