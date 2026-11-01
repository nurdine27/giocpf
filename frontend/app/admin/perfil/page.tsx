import type { Metadata } from 'next';
import { AdminProfile } from '@/components/admin/profile';

export const metadata: Metadata = { title: 'O meu perfil' };

export default function PerfilPage() {
  return <AdminProfile />;
}
