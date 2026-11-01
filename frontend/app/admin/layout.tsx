import type { Metadata } from 'next';
import { AdminLayout } from '@/components/admin/admin-layout';

export const metadata: Metadata = {
  title: { default: 'Administração', template: '%s · Administração GIO' },
  robots: { index: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
