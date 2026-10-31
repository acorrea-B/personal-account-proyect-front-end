import type {
  ComponentPropsWithoutRef,
  ComponentType,
  InputHTMLAttributes,
  ReactNode,
} from 'react';

import type { IconProps } from '@/components/icons';

// The shared Tailwind primitives (docs/tailwind-migration.md). Each one is the
// utility form of a hand-written rule in app/globals.css with the same values,
// so a view that moves to them renders as before. The old rule stays in
// globals.css until its last consumer moves, then it is deleted.

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

// .auth-page: the centered page with the sky wash rising from the top right.
export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center [background:radial-gradient(1200px_620px_at_72%_-8%,var(--color-sky-wash-soft),rgba(227,241,251,0)_68%),var(--color-stone-canvas)] p-24">
      {children}
    </main>
  );
}

// .auth-shell.auth-card: the one white card of an auth page.
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <section className="grid w-full max-w-[560px] gap-16 rounded-lg border border-stone-border bg-pure-white p-32 shadow-subtle max-sm:p-16">
      {children}
    </section>
  );
}

// .auth-card form
export function AuthForm(props: ComponentPropsWithoutRef<'form'>) {
  return <form {...props} className={cx('m-0 grid gap-16', props.className)} />;
}

// .auth-heading: the heading-sm step, the subheading size on a phone (the
// tracking and line height stay those of heading-sm, as before).
export function AuthHeading({ children }: { children: ReactNode }) {
  return (
    <h1 className="m-0 font-roobert text-heading-sm font-regular text-ink-black max-sm:text-(length:--text-subheading)">
      {children}
    </h1>
  );
}

// .auth-subtitle
export function AuthSubtitle({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 text-(length:--text-body-lg) leading-[1.64] text-warm-gray">{children}</p>
  );
}

// .auth-form-note: the hairline-topped footnote of a card.
export function AuthFormNote({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 border-t border-stone-border pt-16 text-[12px] leading-[1.6] text-warm-gray max-sm:text-[14px]">
      {children}
    </p>
  );
}

type Icon = ComponentType<IconProps>;

// .auth-kicker + .auth-kicker-icon
export function AuthKicker({ icon: KickerIcon, children }: { icon: Icon; children: ReactNode }) {
  return (
    <p className="m-0 inline-flex items-center gap-8 text-(length:--text-label) tracking-[0.08em] text-warm-gray uppercase">
      <KickerIcon className="size-[16px] text-cyan-text" /> {children}
    </p>
  );
}

// .auth-steps + .auth-step (+ .is-active) + .auth-step-icon
export function AuthSteps({
  steps,
}: {
  steps: Array<{ icon: Icon; label: string; active?: boolean }>;
}) {
  return (
    <ol className="m-0 grid list-none grid-cols-3 gap-8 p-0">
      {steps.map(({ icon: StepIcon, label, active }) => (
        <li
          key={label}
          className={cx(
            'inline-flex flex-col items-center justify-center gap-4 rounded-md border p-8 text-(length:--text-label) leading-none font-medium',
            active
              ? 'border-cyan-signal bg-cyan-signal text-ink-black'
              : 'border-stone-border text-warm-gray',
          )}
        >
          <StepIcon className="size-[16px]" /> {label}
        </li>
      ))}
    </ol>
  );
}

// .field + .field input: the label wraps its input. A field in error keeps
// the red border from the global input[aria-invalid] rule; focus wins over
// it (important), as the more specific .field input:focus-visible did.
export function Field({
  label,
  ...input
}: { label: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-4" htmlFor={input.id}>
      {label}
      <input
        {...input}
        className="min-h-[44px] rounded-inputs border border-stone-border bg-pure-white px-[14px] py-12 [font-family:inherit] text-[16px] [font-weight:inherit] [line-height:inherit] text-ink-black focus-visible:border-cyan-signal! focus-visible:shadow-[0_0_0_3px_var(--color-sky-wash)] focus-visible:outline-none"
      />
    </label>
  );
}

// .field-error: the paragraph under a field (browser margins kept).
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="text-[12px] leading-[1.5] text-alert">
      {children}
    </p>
  );
}

// .form-error, and .form-error[role='status'] for a confirmation.
export function FormMessage({ tone, children }: { tone: 'alert' | 'status'; children: ReactNode }) {
  return (
    <div
      role={tone}
      className={cx(
        'rounded-lg border px-12 py-8 text-[12px] leading-[1.6] text-soot',
        tone === 'status' ? 'border-cyan-text bg-sky-wash-soft' : 'border-stone-muted',
      )}
    >
      <p>{children}</p>
    </div>
  );
}

// .button + .button-primary
export const primaryButton =
  'inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-4 rounded-full border border-transparent bg-cyan-signal px-[18px] py-[11px] [font-family:inherit] text-[15px] leading-none font-medium text-ink-black transition-all duration-160 ease-[ease] enabled:hover:bg-cyan-edge disabled:cursor-not-allowed disabled:opacity-50 max-sm:px-16 max-sm:text-[16px]';

// .eyebrow: the small uppercase label above a heading.
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 text-(length:--text-label) tracking-[0.08em] text-warm-gray uppercase">
      {children}
    </p>
  );
}

// .link
export function TextLink(props: ComponentPropsWithoutRef<'a'>) {
  return (
    <a
      {...props}
      className={cx(
        'text-cyan-text no-underline hover:text-cyan-text-strong hover:underline',
        props.className,
      )}
    />
  );
}
