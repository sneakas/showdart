export default function RootLayout({ children }) {
  return (
    <html lang="da" suppressHydrationWarning>
      <body style={{ margin: 0 }} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
