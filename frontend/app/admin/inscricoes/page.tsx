'use client';
import { Suspense } from 'react';
import { RequirePermission } from '@/components/admin/admin-layout';
import { RegistrationList } from '@/components/admin/registrations';

export default function InscricoesPage() {
  return (
    <RequirePermission any={['registrations.read']}>
      <Suspense>
        <RegistrationList />
      </Suspense>
    </RequirePermission>
  );
}
