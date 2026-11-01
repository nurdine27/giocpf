'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { API_BASE } from '@/lib/api-url';
import { SHIFTS } from '@/lib/constants';

type Summary = {
  reference: string;
  courseName: string;
  waitlisted: boolean;
  campus: { name: string } | null;
  classGroup: {
    name: string;
    shift: string;
    schedule: string;
    period: { name: string; startsAt: string };
  } | null;
};

function Confirmation() {
  const reference = useSearchParams().get('referencia');
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (!reference) return;
    fetch(`${API_BASE}/registrations/${encodeURIComponent(reference)}/summary`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setSummary)
      .catch(() => undefined);
  }, [reference]);

  const group = summary?.classGroup;
  return (
    <main id="conteudo" className="page-wrap">
      <div className="success-card">
        <span className={`success-icon ${summary?.waitlisted ? 'is-warning' : ''}`}>
          <Icon name={summary?.waitlisted ? 'schedule' : 'task_alt'} />
        </span>
        <h1>{summary?.waitlisted ? 'Está na lista de espera' : 'Inscrição enviada'}</h1>
        <p>
          {summary?.waitlisted
            ? 'De momento não há vagas na turma pretendida. Será colocado(a) automaticamente assim que abrir uma vaga e a nossa equipa entrará em contacto.'
            : 'A equipa do GIO entrará em contacto para confirmar a vaga e os documentos necessários.'}
        </p>
        {reference && (
          <dl className="success-facts">
            <div>
              <dt>Referência</dt>
              <dd>
                <strong>{reference}</strong>
              </dd>
            </div>
            {summary && (
              <div>
                <dt>Curso</dt>
                <dd>{summary.courseName}</dd>
              </div>
            )}
            {summary?.campus && (
              <div>
                <dt>Pólo</dt>
                <dd>{summary.campus.name}</dd>
              </div>
            )}
            {group && (
              <>
                <div>
                  <dt>Turma</dt>
                  <dd>
                    {SHIFTS[group.shift] ?? group.shift}
                    {group.schedule ? ` · ${group.schedule}` : ''}
                  </dd>
                </div>
                <div>
                  <dt>Início das aulas</dt>
                  <dd>
                    {new Date(group.period.startsAt).toLocaleDateString('pt-PT', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </dd>
                </div>
              </>
            )}
          </dl>
        )}
        <p className="page-muted">Guarde a referência para qualquer contacto connosco.</p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/">
            Voltar ao início
          </Link>
          <Link className="button button-light" href="/contactos">
            Falar connosco
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function Success() {
  return (
    <Suspense fallback={<main className="page-wrap">A confirmar inscrição…</main>}>
      <Confirmation />
    </Suspense>
  );
}
