import { redirect } from 'next/navigation';

/** Courses are edited in a dialog on the list page. */
export default function CursoEditRedirect() {
  redirect('/admin/cursos');
}
