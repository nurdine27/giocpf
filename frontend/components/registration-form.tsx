'use client';
import { API_BASE } from '@/lib/api-url';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { areas, provinces } from '@/lib/content';
import { Icon } from '@/components/icon';
import { Notice } from '@/components/public-ui';

type FormOptions = {
  campuses: { id: string; name: string; city: string; address: string }[];
  genders: string[];
  documentTypes: string[];
  educationLevels: string[];
  occupations: string[];
  referralSources: string[];
  shifts: Record<string, string>;
  minAge: number;
  maxAge: number;
};
type CatalogCourse = { name: string; area: string; enrollmentOpen: boolean };
type ClassOption = {
  id: string;
  name: string;
  shift: string;
  schedule: string;
  campus: { name: string };
  period: { name: string; startsAt: string };
  seatsLeft: number;
};

const EMPTY = {
  area: '',
  course: '',
  campusId: '',
  preferredClassId: '',
  name: '',
  birthDate: '',
  gender: '',
  documentType: '',
  documentNumber: '',
  educationLevel: '',
  occupation: '',
  phone: '',
  email: '',
  province: '',
  district: '',
  address: '',
  emergencyName: '',
  emergencyPhone: '',
  referralSource: '',
  message: '',
  consent: false,
};
type FormState = typeof EMPTY;

const STEPS = [
  { title: 'Curso', icon: 'school' },
  { title: 'Dados pessoais', icon: 'person' },
  { title: 'Contactos', icon: 'call' },
  { title: 'Confirmar', icon: 'task_alt' },
];
const DRAFT_KEY = 'gio-inscricao-rascunho';

function isoDateYearsAgo(years: number) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

function formatDay(value: string) {
  return new Date(value).toLocaleDateString('pt-PT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function loadDraft(params: URLSearchParams): FormState {
  let draft: Partial<FormState> = {};
  try {
    draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? '{}');
  } catch {}
  const area = params.get('area');
  const course = params.get('curso');
  return {
    ...EMPTY,
    ...draft,
    ...(area ? { area, course: course ?? '', preferredClassId: '' } : {}),
    consent: false,
  };
}

export function RegistrationForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() =>
    loadDraft(new URLSearchParams(params.toString())),
  );
  const [step, setStep] = useState(0);
  const [options, setOptions] = useState<FormOptions | null>(null);
  const [catalog, setCatalog] = useState<CatalogCourse[]>(() =>
    areas.flatMap((a) => a.courses.map((name) => ({ name, area: a.name, enrollmentOpen: true }))),
  );
  const [availability, setAvailability] = useState<{ key: string; classes: ClassOption[] } | null>(
    null,
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [submissionKey] = useState(() => crypto.randomUUID());
  const stepRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/registrations/form-options`)
      .then((r) => (r.ok ? r.json() : null))
      .then((o: FormOptions | null) => o && setOptions(o))
      .catch(() => setError('Não foi possível carregar o formulário. Recarregue a página.'));
    fetch(`${API_BASE}/courses`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: CatalogCourse[]) => rows.length && setCatalog(rows))
      .catch(() => undefined);
  }, []);

  // Keep a draft so an accidental refresh does not lose the answers (consent is never stored).
  useEffect(() => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...form, consent: false }));
  }, [form]);

  const availabilityKey =
    form.course && form.campusId ? `${form.area}|${form.course}|${form.campusId}` : '';
  useEffect(() => {
    if (!availabilityKey) return;
    const [area, course, campusId] = availabilityKey.split('|');
    const qs = new URLSearchParams({ area, course, campusId });
    fetch(`${API_BASE}/registrations/availability?${qs}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((classes: ClassOption[]) => setAvailability({ key: availabilityKey, classes }))
      .catch(() => setAvailability({ key: availabilityKey, classes: [] }));
  }, [availabilityKey]);
  const classes = availability?.key === availabilityKey ? availability.classes : null;

  const courses = useMemo(() => catalog.filter((c) => c.area === form.area), [catalog, form.area]);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function goTo(next: number) {
    setError('');
    setStep(next);
    requestAnimationFrame(() => {
      headingRef.current?.focus();
      headingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /** Native validation of the visible step only; focuses the first invalid field. */
  function stepIsValid() {
    const fields = stepRef.current?.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >('input, select, textarea');
    for (const field of Array.from(fields ?? [])) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    return true;
  }

  function next(e: React.FormEvent) {
    e.preventDefault();
    if (!stepIsValid()) return;
    if (step < STEPS.length - 1) goTo(step + 1);
    else void submit();
  }

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const r = await fetch(`${API_BASE}/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          birthDate: form.birthDate ? new Date(`${form.birthDate}T12:00:00`).toISOString() : '',
          submissionKey,
        }),
      });
      const result = await r.json().catch(() => ({}));
      if (!r.ok)
        throw new Error(
          Array.isArray(result.message)
            ? result.message.join(' ')
            : result.message || 'Não foi possível enviar a inscrição.',
        );
      sessionStorage.removeItem(DRAFT_KEY);
      router.push(`/inscricao/sucesso?referencia=${encodeURIComponent(result.reference)}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'O serviço de inscrições não está disponível neste momento.',
      );
    } finally {
      setBusy(false);
    }
  }

  const campus = options?.campuses.find((c) => c.id === form.campusId);
  const chosenClass = classes?.find((c) => c.id === form.preferredClassId);
  const summary: [string, string][] = [
    ['Curso', `${form.course} (${form.area})`],
    ['Pólo', campus?.name ?? '—'],
    [
      'Turma',
      chosenClass
        ? `${options?.shifts[chosenClass.shift]} · início ${formatDay(chosenClass.period.startsAt)}`
        : classes?.length
          ? 'Primeira turma disponível'
          : 'Lista de espera',
    ],
    ['Nome', form.name],
    ['Data de nascimento', form.birthDate ? formatDay(form.birthDate) : '—'],
    ['Telefone', form.phone],
    ['E-mail', form.email || '—'],
    ['Residência', [form.address, form.district, form.province].filter(Boolean).join(', ')],
  ];

  return (
    <form className="wizard" onSubmit={next} noValidate>
      <ol className="wizard-steps" aria-label="Passos da inscrição">
        {STEPS.map((s, i) => (
          <li key={s.title} className={i === step ? 'is-current' : i < step ? 'is-done' : ''}>
            <button
              type="button"
              onClick={() => i < step && goTo(i)}
              disabled={i > step}
              aria-current={i === step ? 'step' : undefined}
            >
              <span className="wizard-dot">{i < step ? <Icon name="check" /> : i + 1}</span>
              <span className="wizard-label">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="wizard-progress" aria-hidden="true">
        <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      <div className="form-card wizard-card" ref={stepRef}>
        <h2 ref={headingRef} tabIndex={-1}>
          <Icon name={STEPS[step].icon} /> {STEPS[step].title}
          <small>
            Passo {step + 1} de {STEPS.length}
          </small>
        </h2>

        {step === 0 && (
          <div className="form-grid">
            <div className="field">
              <label htmlFor="area">Área de formação *</label>
              <select
                id="area"
                required
                value={form.area}
                onChange={(e) =>
                  setForm((f) => ({ ...f, area: e.target.value, course: '', preferredClassId: '' }))
                }
              >
                <option value="">Seleccione a área</option>
                {areas.map((a) => (
                  <option key={a.name}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="course">Curso *</label>
              <select
                id="course"
                required
                disabled={!form.area}
                value={courses.some((c) => c.name === form.course) ? form.course : ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, course: e.target.value, preferredClassId: '' }))
                }
              >
                <option value="">
                  {form.area ? 'Seleccione o curso' : 'Seleccione primeiro a área'}
                </option>
                {courses.map((c) => (
                  <option key={c.name} value={c.name} disabled={!c.enrollmentOpen}>
                    {c.name}
                    {c.enrollmentOpen ? '' : ' (inscrições encerradas)'}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="field full choice-group">
              <legend>Onde pretende estudar? *</legend>
              <div className="choice-grid">
                {options?.campuses.map((c) => (
                  <label
                    key={c.id}
                    className={`choice ${form.campusId === c.id ? 'is-selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="campusId"
                      value={c.id}
                      required
                      checked={form.campusId === c.id}
                      onChange={() =>
                        setForm((f) => ({ ...f, campusId: c.id, preferredClassId: '' }))
                      }
                    />
                    <Icon name="location_city" />
                    <span>
                      <strong>{c.name}</strong>
                      <small>{c.address || c.city}</small>
                    </span>
                  </label>
                ))}
                {!options && <span className="page-muted">A carregar pólos…</span>}
              </div>
            </fieldset>
            {availabilityKey && (
              <fieldset className="field full choice-group">
                <legend>Turma</legend>
                {!classes && <p className="page-muted">A verificar vagas…</p>}
                {classes && classes.length === 0 && (
                  <Notice type="error">
                    Neste momento não há vagas para este curso neste pólo. Pode continuar: a
                    inscrição fica em lista de espera e será colocado(a) assim que abrir uma turma.
                  </Notice>
                )}
                {classes && classes.length > 0 && (
                  <div className="choice-grid">
                    <label className={`choice ${!form.preferredClassId ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="preferredClassId"
                        value=""
                        checked={!form.preferredClassId}
                        onChange={() => set('preferredClassId', '')}
                      />
                      <Icon name="bolt" />
                      <span>
                        <strong>Primeira turma disponível</strong>
                        <small>Colocamos na turma com vagas que começa primeiro.</small>
                      </span>
                    </label>
                    {classes.map((c) => (
                      <label
                        key={c.id}
                        className={`choice ${form.preferredClassId === c.id ? 'is-selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="preferredClassId"
                          value={c.id}
                          checked={form.preferredClassId === c.id}
                          onChange={() => set('preferredClassId', c.id)}
                        />
                        <Icon name="schedule" />
                        <span>
                          <strong>
                            {options?.shifts[c.shift] ?? c.shift}
                            {c.schedule ? ` · ${c.schedule}` : ''}
                          </strong>
                          <small>
                            Início {formatDay(c.period.startsAt)} ·{' '}
                            <b className={c.seatsLeft <= 5 ? 'seats-low' : ''}>
                              {c.seatsLeft} {c.seatsLeft === 1 ? 'vaga' : 'vagas'}
                            </b>
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="name">Nome completo *</label>
              <input
                id="name"
                autoComplete="name"
                required
                minLength={3}
                maxLength={120}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="birthDate">Data de nascimento *</label>
              <input
                id="birthDate"
                type="date"
                autoComplete="bday"
                required
                min={isoDateYearsAgo(options?.maxAge ?? 99)}
                max={isoDateYearsAgo(options?.minAge ?? 14)}
                value={form.birthDate}
                onChange={(e) => set('birthDate', e.target.value)}
              />
              <small className="field-hint">Idade mínima: {options?.minAge ?? 14} anos.</small>
            </div>
            <div className="field">
              <label htmlFor="gender">Género *</label>
              <select
                id="gender"
                required
                value={form.gender}
                onChange={(e) => set('gender', e.target.value)}
              >
                <option value="">Seleccione</option>
                {options?.genders.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="documentType">Documento de identificação</label>
              <select
                id="documentType"
                value={form.documentType}
                onChange={(e) => set('documentType', e.target.value)}
              >
                <option value="">Seleccione (opcional)</option>
                {options?.documentTypes.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="documentNumber">Número do documento</label>
              <input
                id="documentNumber"
                maxLength={40}
                required={!!form.documentType}
                value={form.documentNumber}
                onChange={(e) => set('documentNumber', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="educationLevel">Nível de escolaridade *</label>
              <select
                id="educationLevel"
                required
                value={form.educationLevel}
                onChange={(e) => set('educationLevel', e.target.value)}
              >
                <option value="">Seleccione</option>
                {options?.educationLevels.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="occupation">Ocupação actual</label>
              <select
                id="occupation"
                value={form.occupation}
                onChange={(e) => set('occupation', e.target.value)}
              >
                <option value="">Seleccione (opcional)</option>
                {options?.occupations.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="form-grid">
            <div className="field">
              <label htmlFor="phone">Telefone / WhatsApp *</label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                required
                minLength={8}
                maxLength={24}
                placeholder="+258"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
              <small className="field-hint">Recebe a confirmação da inscrição por e-mail.</small>
            </div>
            <div className="field">
              <label htmlFor="province">Província de residência *</label>
              <select
                id="province"
                required
                value={form.province}
                onChange={(e) => setForm((f) => ({ ...f, province: e.target.value, district: '' }))}
              >
                <option value="">Seleccione a província</option>
                {Object.keys(provinces)
                  .sort()
                  .map((p) => (
                    <option key={p}>{p}</option>
                  ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="district">Distrito *</label>
              <select
                id="district"
                required
                disabled={!form.province}
                value={form.district}
                onChange={(e) => set('district', e.target.value)}
              >
                <option value="">
                  {form.province ? 'Seleccione o distrito' : 'Seleccione primeiro a província'}
                </option>
                {(provinces[form.province] ?? []).map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="address">Bairro / endereço</label>
              <input
                id="address"
                autoComplete="street-address"
                maxLength={200}
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="emergencyName">Contacto de emergência (nome)</label>
              <input
                id="emergencyName"
                maxLength={120}
                value={form.emergencyName}
                onChange={(e) => set('emergencyName', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="emergencyPhone">Contacto de emergência (telefone)</label>
              <input
                id="emergencyPhone"
                type="tel"
                minLength={8}
                maxLength={24}
                value={form.emergencyPhone}
                onChange={(e) => set('emergencyPhone', e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="form-grid">
            <dl className="field full review-list">
              {summary.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="field">
              <label htmlFor="referralSource">Como soube do GIO?</label>
              <select
                id="referralSource"
                value={form.referralSource}
                onChange={(e) => set('referralSource', e.target.value)}
              >
                <option value="">Seleccione (opcional)</option>
                {options?.referralSources.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="message">Mensagem (opcional)</label>
              <textarea
                id="message"
                maxLength={1000}
                value={form.message}
                onChange={(e) => set('message', e.target.value)}
              />
            </div>
            <div className="field full">
              <label className="check-field">
                <input
                  type="checkbox"
                  required
                  checked={form.consent}
                  onChange={(e) => set('consent', e.target.checked)}
                />
                <span>
                  Confirmo que os dados são verdadeiros e autorizo o GIO Centro de Formação a
                  tratá-los para gerir esta inscrição, conforme a{' '}
                  <Link href="/politica-de-privacidade">Política de Privacidade</Link>. *
                </span>
              </label>
            </div>
          </div>
        )}

        {error && <Notice type="error">{error}</Notice>}

        <div className="wizard-actions">
          {step > 0 ? (
            <button type="button" className="button button-light" onClick={() => goTo(step - 1)}>
              <Icon name="arrow_back" /> Anterior
            </button>
          ) : (
            <span />
          )}
          <button className="button button-primary" type="submit" disabled={busy || !options}>
            {step < STEPS.length - 1 ? (
              <>
                Continuar <Icon name="arrow_forward" />
              </>
            ) : busy ? (
              'A enviar…'
            ) : (
              <>
                Enviar inscrição <Icon name="send" />
              </>
            )}
          </button>
        </div>
        <p className="page-muted wizard-note">
          <Icon name="lock" /> Os campos com * são obrigatórios. As respostas ficam guardadas neste
          dispositivo até enviar.
        </p>
      </div>
    </form>
  );
}
