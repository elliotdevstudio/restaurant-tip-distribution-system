import { Inter } from 'next/font/google';
import './globals.css';
import ClientProvider from './providers/ClientProvider';
import Link from 'next/link';

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
          <nav className="bg-gray-800 text-white p-4">
            <div className="container mx-auto">
              <div className="flex items-center space-x-6">
                <Link href="/" className="hover:text-gray-300 font-semibold text-lg">
                  Dashboard
                </Link>
                <Link href="/staff/members" className="hover:text-gray-300">
                  Staff Members
                </Link>
                <Link href="/staff/groups" className="hover:text-gray-300">
                  Staff Groups
                </Link>
                <Link href="/demo" className="hover:text-gray-300">
                  Daily Shift Generator
                </Link>
                <Link href="/reports" className="hover:text-gray-300">
                  Shift Reports
                </Link>
              </div>
            </div>
          </nav>
          <main className="min-h-screen bg-gray-50">
            {children}
          </main>
        </ClientProvider>
      </body>
    </html>
  );
}
