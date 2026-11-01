'use client';
import { RequirePermission } from '@/components/admin/admin-layout';
import { CourseAdmin } from '@/components/admin/courses';

export default function CursosPage() {
  return (
    <RequirePermission any={['courses.manage']}>
      <CourseAdmin />
    </RequirePermission>
  );
}
