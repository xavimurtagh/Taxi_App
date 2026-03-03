export const metadata = {
  title: 'OpenRide — Community-Owned Ride Sharing',
  description: 'Transparent, community-governed ride-sharing platform. View real-time platform data, financial reports, and governance proposals.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head />
      <body>{children}</body>
    </html>
  );
}
