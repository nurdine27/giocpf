'use client';
import { use } from 'react';
import { RequirePermission } from '@/components/admin/admin-layout';
import { RegistrationDetail } from '@/components/admin/registrations';

export default function InscricaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission any={['registrations.read']}>
      <RegistrationDetail id={id} />
    </RequirePermission>
  );
}
