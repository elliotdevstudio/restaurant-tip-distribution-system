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
          <nav className="bg-gray-900 text-white border-b border-gray-800">
            <div className="container mx-auto px-6">
              <div className="flex items-center h-16">
                {/* GRAT Brand Logo */}
                <Link 
                  href="/" 
                  className="text-2xl font-bold tracking-tight text-white hover:text-blue-400 transition-colors mr-10"
                >
                  GRAT
                </Link>
                
                {/* Navigation Links */}
                <div className="flex items-center space-x-8 text-sm font-medium">
                  <Link 
                    href="/" 
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    Dashboard
                  </Link>
                  <Link 
                    href="/staff/members" 
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    Staff Members
                  </Link>
                  <Link 
                    href="/staff/groups" 
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    Staff Groups
                  </Link>
                  <Link 
                    href="/demo" 
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    Daily Shift Generator
                  </Link>
                  <Link 
                    href="/reports" 
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    Shift Reports
                  </Link>
                </div>
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