import './globals.css'

export const metadata = {
  title: 'Groww Bot Dashboard',
  description: 'VR20 + VR10 trading bot analytics',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
