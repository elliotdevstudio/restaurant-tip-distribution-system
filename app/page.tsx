'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, 
  UsersRound, 
  Calendar, 
  FileText,
  Clock
} from 'lucide-react';
import WelcomeModal from './components/staff/WelcomeModal';

interface DashboardCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  colorClass: string;
}

function DashboardCard({ title, description, href, icon, colorClass }: DashboardCardProps) {
  return (
    <Link href={href}>
      <div className="group relative bg-white rounded-lg border-2 border-gray-200 hover:border-blue-500 shadow-md hover:shadow-lg p-6 cursor-pointer h-full transition-all duration-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg mb-4 ${colorClass}`}>
              {icon}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
              {title}
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              {description}
            </p>
          </div>
          <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <svg 
              className="w-5 h-5 text-blue-500"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9 5l7 7-7 7" 
              />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}

function CurrentDateTime() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="text-right">
      <div className="flex items-center justify-end gap-2 text-gray-600 mb-1">
        <Clock className="w-4 h-4" />
        <p className="text-sm font-medium" suppressHydrationWarning>
          {formatDate(currentTime)}
        </p>
      </div>
      <p className="text-2xl font-semibold text-gray-900 tabular-nums" suppressHydrationWarning>
        {formatTime(currentTime)}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const dashboardCards = [
    {
      title: 'Staff Members',
      description: 'Manage your restaurant staff members, add new employees, and update their information.',
      href: '/staff/members',
      icon: <Users className="w-6 h-6 text-blue-600" />,
      colorClass: 'bg-blue-50'
    },
    {
      title: 'Staff Groups',
      description: 'Create and manage staff groups, configure tip distribution settings, and set up tip pooling.',
      href: '/staff/groups',
      icon: <UsersRound className="w-6 h-6 text-purple-600" />,
      colorClass: 'bg-purple-50'
    },
    {
      title: 'Daily Shift Generator',
      description: 'Captures daily sales, staff hours, and detailed tips information to calculate payroll for staff members.',
      href: '/demo',
      icon: <Calendar className="w-6 h-6 text-green-600" />,
      colorClass: 'bg-green-50'
    },
    {
      title: 'Shift Reports',
      description: 'View historical shift data, analyze tip distribution patterns, and generate reports.',
      href: '/shifts',
      icon: <FileText className="w-6 h-6 text-orange-600" />,
      colorClass: 'bg-orange-50'
    }
  ];

  return (
  <>
    <WelcomeModal />
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Gratuity Distribution System
            </h1>
            <p className="text-gray-600">
              Manage tip pooling, staff groups, and shift distributions with ease
            </p>
          </div>
          <CurrentDateTime />
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {dashboardCards.map((card, index) => (
          <DashboardCard key={index} {...card} />
        ))}
      </div>

      {/* Quick Stats Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">
          Quick Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600 mb-1">—</p>
            <p className="text-sm text-gray-600">Active Staff Members</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-purple-600 mb-1">—</p>
            <p className="text-sm text-gray-600">Staff Groups</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600 mb-1">—</p>
            <p className="text-sm text-gray-600">Shifts This Week</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 text-center mt-4">
          Stats will populate automatically as you add data
        </p>
      </div>
    </div>
  </>
  );
}
