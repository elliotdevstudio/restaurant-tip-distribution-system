import { Inter } from 'next/font/google';
import './globals.css';
import ClientProvider from './providers/ClientProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Staff Management System',
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
              <div className="flex space-x-4">
                <a href="/staff/members" className="hover:text-gray-300">Staff Members</a>
                <a href="/staff/groups" className="hover:text-gray-300">Staff Groups</a>
                <a href="/demo" className="hover:text-gray-300">Generate Daily Shift</a>
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