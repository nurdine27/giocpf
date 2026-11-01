'use client';
import { RequirePermission } from '@/components/admin/admin-layout';
import { ReportsAdmin } from '@/components/admin/reports';
import { REPORT_PERMISSIONS } from '@/lib/constants';

export default function RelatoriosPage() {
  return (
    <RequirePermission any={REPORT_PERMISSIONS}>
      <ReportsAdmin />
    </RequirePermission>
  );
}
