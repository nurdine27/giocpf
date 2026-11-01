'use client';
import { RequirePermission } from '@/components/admin/admin-layout';
import { AdminSettings } from '@/components/admin/settings';

export default function ConfiguracoesPage() {
  return (
    <RequirePermission any={['settings.manage']}>
      <AdminSettings />
    </RequirePermission>
  );
}
