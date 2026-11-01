'use client';
import { Suspense } from 'react';
import { RequirePermission } from '@/components/admin/admin-layout';
import { ClassesAdmin } from '@/components/admin/classes';

export default function TurmasPage() {
  return (
    <RequirePermission any={['classes.read']}>
      <Suspense>
        <ClassesAdmin />
      </Suspense>
    </RequirePermission>
  );
}
