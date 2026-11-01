'use client';
import { Suspense } from 'react';
import { RequirePermission } from '@/components/admin/admin-layout';
import { ContentAdmin } from '@/components/admin/content';
import { CONTENT_PERMISSIONS } from '@/lib/constants';

export default function ConteudosPage() {
  return (
    <RequirePermission any={CONTENT_PERMISSIONS}>
      <Suspense>
        <ContentAdmin />
      </Suspense>
    </RequirePermission>
  );
}
