import { RegistrationDetail } from '@/components/registration-detail';
export default async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RegistrationDetail id={id} />;
}
