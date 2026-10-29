import { CourseEditForm } from '@/components/course-edit-form';
export default async function EditCourse({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CourseEditForm id={id} />;
}
