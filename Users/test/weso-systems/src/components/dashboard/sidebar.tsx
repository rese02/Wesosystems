'use client';

import {
  Hotel,
  LayoutDashboard,
  Settings,
  BookOpen,
  Home,
  Users,
  MountainIcon,
  User,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type DashboardSidebarProps = {
  role: 'agency' | 'hotelier';
  hotelId?: string;
  hotelName?: string;
};

export function DashboardSidebar({ role, hotelId, hotelName }: DashboardSidebarProps) {
  const pathname = usePathname();

  const agencyLinks = [
    {
      href: '/admin',
      icon: <LayoutDashboard />,
      label: 'Übersicht',
    },
    {
      href: '/admin/create-hotel',
      icon: <Hotel />,
      label: 'Hotel anlegen',
    },
    {
      href: '/admin/profile',
      icon: <User />,
      label: 'Profil',
    },
     {
      href: '/',
      icon: <Home />,
      label: 'Zur Startseite',
    },
  ];

  const hotelierLinks = hotelId
    ? [
        {
          href: `/dashboard/${hotelId}`,
          icon: <LayoutDashboard />,
          label: 'Dashboard',
        },
        {
          href: `/dashboard/${hotelId}/bookings`,
          icon: <BookOpen />,
          label: 'Buchungen',
        },
        {
          href: `/dashboard/${hotelId}/settings`,
          icon: <Settings />,
          label: 'Stammdaten',
        },
         {
          href: `/dashboard/${hotelId}/profile`,
          icon: <User />,
          label: 'Profil',
        },
      ]
    : [];

  const links = role === 'agency' ? agencyLinks : hotelierLinks;

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-200">
                <MountainIcon className="h-6 w-6 text-gray-600" />
            </div>
          <h1 className="text-lg font-headline font-semibold capitalize">{role === 'agency' ? 'WesoSystems' : hotelName}</h1>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {links.map((link) => (
            <SidebarMenuItem key={link.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === link.href}
                tooltip={{ children: link.label }}
              >
                <Link href={link.href}>
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
