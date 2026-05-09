import "./globals.css";

export const metadata = {
  title: "Crime Detection System",
  description: "A clean, modern dashboard for AI-assisted incident detection and response.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
