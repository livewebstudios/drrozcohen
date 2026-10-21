import { useRef, useState } from 'react';

/**
 * Contact form. Server-rendered as a real <form> that posts to Formspree, so it works with
 * JS off. Once hydrated it validates inline, counts characters and posts with fetch.
 * The _gotcha honeypot replaces the CAPTCHA.
 */
type Props = {
  formId: string;
  /** Prefix for element ids so two forms can share a page safely. */
  idPrefix?: string;
  thanksUrl: string;
};

type Errors = Partial<Record<'name' | 'email' | 'message', string>>;
const MAX = 600;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function ContactForm({ formId, idPrefix = 'cf', thanksUrl }: Props) {
  const [count, setCount] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const formRef = useRef<HTMLFormElement>(null);
  const action = `https://formspree.io/f/${formId}`;
  const id = (k: string) => `${idPrefix}-${k}`;

  const validate = (fd: FormData): Errors => {
    const e: Errors = {};
    if (!String(fd.get('name') || '').trim()) e.name = 'Please add your name.';
    const email = String(fd.get('email') || '').trim();
    if (!email) e.email = 'Please add your email.';
    else if (!EMAIL_RE.test(email)) e.email = "That email doesn't look right.";
    if (!String(fd.get('message') || '').trim()) e.message = 'Please add a message.';
    return e;
  };

  const onSubmit = async (ev: { preventDefault(): void; currentTarget: HTMLFormElement }) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const fd = new FormData(form);
    const e = validate(fd);
    setErrors(e);
    const first = (['name', 'email', 'message'] as const).find((k) => e[k]);
    if (first) {
      form.querySelector<HTMLElement>(`#${id(first)}`)?.focus();
      return;
    }
    if (String(fd.get('_gotcha') || '')) {
      setStatus('success');
      return;
    }
    setStatus('sending');
    try {
      const res = await fetch(action, { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      setCount(0);
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  const fieldProps = (k: keyof Errors) => ({
    id: id(k),
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': [errors[k] ? id(`${k}-err`) : '', k === 'message' ? id('count') : ''].filter(Boolean).join(' ') || undefined,
    onInput: () => errors[k] && setErrors((prev) => ({ ...prev, [k]: undefined })),
  });

  return (
    <form ref={formRef} className="cform" action={action} method="POST" noValidate onSubmit={onSubmit}>
      <input type="hidden" name="_subject" value="New message from drrozcohen.com" />
      <input type="hidden" name="_next" value={thanksUrl} />
      <div className="cform__gotcha" aria-hidden="true">
        <label htmlFor={id('gotcha')}>Leave this field empty</label>
        <input type="text" id={id('gotcha')} name="_gotcha" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="cform__row cform__row--split">
        <div className="cform__field">
          <label className="cform__label" htmlFor={id('name')}>
            Name <span className="cform__req" aria-hidden="true">*</span>
          </label>
          <input className="cform__input" type="text" name="name" autoComplete="name" required {...fieldProps('name')} />
          {errors.name && (
            <p className="cform__error" id={id('name-err')}>
              {errors.name}
            </p>
          )}
        </div>
        <div className="cform__field">
          <label className="cform__label" htmlFor={id('email')}>
            Email <span className="cform__req" aria-hidden="true">*</span>
          </label>
          <input className="cform__input" type="email" name="email" autoComplete="email" inputMode="email" required {...fieldProps('email')} />
          {errors.email && (
            <p className="cform__error" id={id('email-err')}>
              {errors.email}
            </p>
          )}
        </div>
      </div>

      <div className="cform__field">
        <label className="cform__label" htmlFor={id('phone')}>
          Phone <span className="cform__opt">(optional)</span>
        </label>
        <input className="cform__input" type="tel" id={id('phone')} name="phone" autoComplete="tel" inputMode="tel" />
      </div>

      <div className="cform__field">
        <label className="cform__label" htmlFor={id('message')}>
          Message <span className="cform__req" aria-hidden="true">*</span>
        </label>
        <textarea
          className="cform__input"
          name="message"
          rows={6}
          maxLength={MAX}
          required
          {...fieldProps('message')}
          onChange={(e) => setCount(e.currentTarget.value.length)}
        />
        <div className="cform__meta">
          {errors.message ? (
            <p className="cform__error" id={id('message-err')}>
              {errors.message}
            </p>
          ) : (
            <span />
          )}
          <span className={`cform__count${count > MAX - 60 ? ' is-near' : ''}`} id={id('count')}>
            {count} / {MAX}
          </span>
        </div>
      </div>

      <div className="cform__actions">
        <button type="submit" className="btn btn--solid cform__submit" disabled={status === 'sending'} aria-busy={status === 'sending'}>
          SEND MESSAGE
        </button>
      </div>
      <div className="cform__status-wrap" aria-live="polite">
        {status === 'success' && <p className="cform__status is-success">Thanks. Roz will be in touch shortly.</p>}
        {status === 'error' && (
          <p className="cform__status is-error">
            That didn't go through. Please email <a href="mailto:info@drrozcohen.com">info@drrozcohen.com</a>.
          </p>
        )}
      </div>
    </form>
  );
}
