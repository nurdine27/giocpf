'use client';
import { Suspense } from 'react';
import { RequirePermission } from '@/components/admin/admin-layout';
import { MessageInbox } from '@/components/admin/messages';

export default function MensagensPage() {
  return (
    <RequirePermission any={['messages.read']}>
      <Suspense>
        <MessageInbox />
      </Suspense>
    </RequirePermission>
  );
}
