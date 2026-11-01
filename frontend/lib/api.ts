import { API_BASE } from './api-url';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type Options = Omit<RequestInit, 'body'> & { body?: unknown };

const FALLBACK = 'Não foi possível concluir o pedido. Verifique a ligação e tente novamente.';

/** Browser-side fetch for the admin API: sends the session cookie, parses JSON and raises readable errors. */
export async function apiFetch<T = unknown>(
  path: string,
  { body, headers, ...init }: Options = {},
) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      ...init,
      headers:
        isForm || body === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(FALLBACK, 0);
  }
  const data = await response.json().catch(() => null);
  if (response.status === 401 && typeof window !== 'undefined') {
    const { pathname } = window.location;
    if (pathname.startsWith('/admin') && pathname !== '/admin/login')
      // A full reload is intended: it drops all in-memory admin state after the session expired.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/admin/login?next=${encodeURIComponent(pathname)}`);
  }
  if (!response.ok) {
    const message = data?.message;
    throw new ApiError(
      typeof message === 'string' ? message : Array.isArray(message) ? message.join(' ') : FALLBACK,
      response.status,
    );
  }
  return data as T;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : FALLBACK;
}

export type UploadedImage = {
  url: string;
  publicId: string;
  name: string;
  width: number;
  height: number;
};
export type UploadFolder = 'conteudos' | 'cursos' | 'perfis' | 'instituicao';

export function uploadImages(files: File[], folder: UploadFolder) {
  const form = new FormData();
  files.forEach((file) => form.append('images', file));
  return apiFetch<UploadedImage[]>(`/admin/uploads?folder=${folder}`, {
    method: 'POST',
    body: form,
  });
}
