'use client';
import { RequirePermission } from '@/components/admin/admin-layout';
import { Dashboard } from '@/components/admin/dashboard';

export default function AdminHome() {
  return (
    <RequirePermission any={['dashboard.read']}>
      <Dashboard />
    </RequirePermission>
  );
}
