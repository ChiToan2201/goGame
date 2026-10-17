import type {Metadata, Viewport} from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import './globals.css';

const beVietnamPro = Be_Vietnam_Pro({
  weight: ['400', '500', '600', '700', '800', '900'],
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Cờ Vây Kẹp Quân Online - Đối Kháng Thời Gian Thực',
  description: 'Game cờ vây kẹp quân online đối kháng thời gian thực. Giới hạn 45 giây mỗi lượt, xử thua khi hết giờ.',
  openGraph: {
    title: 'Cờ Vây Kẹp Quân Online',
    description: 'Game cờ vây kẹp quân đối kháng online thời gian thực. Ghép trận nhanh, chơi cùng bạn bè hoặc thách đấu AI.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cờ Vây Kẹp Quân Online',
    description: 'Game cờ vây kẹp quân đối kháng online thời gian thực.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="vi" className={beVietnamPro.className}>
      <body suppressHydrationWarning className={beVietnamPro.className}>
        {children}
      </body>
    </html>
  );
}
