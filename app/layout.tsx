import { Inter } from 'next/font/google';
import './globals.css';
import ClientProvider from './providers/ClientProvider';
import Navbar from './components/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Gratuity Distribution System',
  description: 'Manage staff members and groups with gratuity distribution',
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClientProvider>
          <Navbar />
          <main className="min-h-screen bg-gray-50">
            {children}
          </main>
        </ClientProvider>
      </body>
    </html>
  );
}