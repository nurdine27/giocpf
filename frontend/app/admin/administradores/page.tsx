'use client';
import { RequirePermission } from '@/components/admin/admin-layout';
import { TeamAdmin } from '@/components/admin/users';

export default function AdministradoresPage() {
  return (
    <RequirePermission any={['users.manage']}>
      <TeamAdmin />
    </RequirePermission>
  );
}
