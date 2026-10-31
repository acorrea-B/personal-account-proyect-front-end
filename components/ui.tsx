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
export function AuthPage({ busy, children }: { busy?: boolean; children: ReactNode }) {
  return (
    <main
      aria-busy={busy ? 'true' : undefined}
      className="grid min-h-screen place-items-center [background:radial-gradient(1200px_620px_at_72%_-8%,var(--color-sky-wash-soft),rgba(227,241,251,0)_68%),var(--color-stone-canvas)] p-24"
    >
      {children}
    </main>
  );
}

// .auth-shell.auth-card: the one white card of an auth page.
// wide: the card inside a workspace page (the old .workspace-page
// .auth-shell.auth-card rule), centered at 800px.
export function AuthCard({
  wide,
  label,
  children,
}: {
  wide?: boolean;
  label?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className={cx(
        'grid w-full gap-16 rounded-lg border border-stone-border bg-pure-white p-32 shadow-subtle max-sm:p-16',
        wide ? 'max-w-[800px] justify-self-center' : 'max-w-[560px]',
      )}
    >
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
export function AuthFormNote({ hidden, children }: { hidden?: boolean; children: ReactNode }) {
  return (
    <p
      aria-hidden={hidden ? true : undefined}
      className="m-0 border-t border-stone-border pt-16 text-[12px] leading-[1.6] text-warm-gray max-sm:text-[14px]"
    >
      {children}
    </p>
  );
}

type Icon = ComponentType<IconProps>;

// .auth-kicker + .auth-kicker-icon
export function AuthKicker({ icon: KickerIcon, children }: { icon?: Icon; children: ReactNode }) {
  return (
    <p className="m-0 inline-flex items-center gap-8 text-(length:--text-label) tracking-[0.08em] text-warm-gray uppercase">
      {KickerIcon ? (
        <>
          <KickerIcon className="size-[16px] text-cyan-text" /> {children}
        </>
      ) : (
        <>
          <span className="size-[16px] text-cyan-text">●</span>
          {children}
        </>
      )}
    </p>
  );
}

// .auth-steps + .auth-step (+ .is-active) + .auth-step-icon
export function AuthSteps({
  steps,
  label,
}: {
  steps: Array<{ icon: Icon; label: string; active?: boolean }>;
  label?: string;
}) {
  return (
    <ol aria-label={label} className="m-0 grid list-none grid-cols-3 gap-8 p-0">
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

// .field input
export const inputClass =
  'min-h-[44px] rounded-inputs border border-stone-border bg-pure-white px-[14px] py-12 [font-family:inherit] text-[16px] [font-weight:inherit] [line-height:inherit] text-ink-black focus-visible:border-cyan-signal! focus-visible:shadow-[0_0_0_3px_var(--color-sky-wash)] focus-visible:outline-none';

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
      <input {...input} className={inputClass} />
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
export function FormMessage({
  tone,
  className,
  children,
}: {
  tone: 'alert' | 'status';
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone}
      className={cx(
        'rounded-lg border px-12 py-8 text-[12px] leading-[1.6] text-soot',
        tone === 'status' ? 'border-cyan-text bg-sky-wash-soft' : 'border-stone-muted',
        className,
      )}
    >
      <p>{children}</p>
    </div>
  );
}

// .button: the pill every action shares (44px touch target).
const buttonBase =
  'inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-4 rounded-full border px-[18px] py-[11px] [font-family:inherit] text-[15px] leading-none font-medium transition-all duration-160 ease-[ease] disabled:cursor-not-allowed disabled:opacity-50 max-sm:px-16 max-sm:text-[16px]';

// .button.button-primary: the cyan signal action, one per view.
export const primaryButton = cx(
  buttonBase,
  'border-transparent bg-cyan-signal text-ink-black enabled:hover:bg-cyan-edge',
);

// The outlined cyan action (the export's Cyan Edge role: outlined action
// borders): a positive action that repeats in a list, where a filled cyan
// button would break the one-primary-per-view rule.
export const outlineButton = cx(
  buttonBase,
  'border-cyan-edge bg-transparent text-cyan-text-strong enabled:hover:bg-sky-wash-soft',
);

// .button.button-ghost: the quiet hairline action.
export const ghostButton = cx(buttonBase, 'border-stone-border bg-transparent text-ink-black');

// .workspace-page: the signed-in page column.
export function WorkspacePage({ busy, children }: { busy?: boolean; children: ReactNode }) {
  return (
    <main
      className="mx-auto grid min-h-screen w-full max-w-page content-start gap-32 p-24"
      aria-busy={busy ? 'true' : undefined}
    >
      {children}
    </main>
  );
}

// .workspace-bar + .workspace-identity: the identity row over a signed-in
// page; on a phone it stacks and the account menu takes the full width.
export function WorkspaceBar({ identity, children }: { identity: ReactNode; children: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-16 border-b border-stone-border pb-24 max-sm:flex-col max-sm:items-stretch">
      <div className="max-sm:w-full">{identity}</div>
      {children}
    </header>
  );
}

// .workspace-title
export function WorkspaceTitle({
  as: Tag = 'h1',
  children,
}: {
  as?: 'h1' | 'p';
  children: ReactNode;
}) {
  return (
    <Tag className="mx-0 mt-4 mb-8 font-roobert text-heading-sm font-regular text-ink-black">
      {children}
    </Tag>
  );
}

// .skill-chips: the skills as tinted badges. Skills named in `marked`
// (lowercased) carry a check and the given label for assistive tech: the
// dashboard marks the ones accepted from a harness suggestion.
export function SkillChips({
  skills,
  label,
  marked,
  markedLabel,
}: {
  skills: string[];
  label?: string;
  marked?: ReadonlySet<string>;
  markedLabel?: string;
}) {
  return (
    <ul
      className="m-0 flex list-none flex-wrap gap-8 p-0"
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {skills.map((skill) => {
        const isMarked = marked?.has(skill.toLowerCase()) ?? false;
        return (
          <li
            key={skill.toLowerCase()}
            className={cx(
              'rounded-full border px-12 py-4 text-[14px] font-medium text-cyan-text-strong',
              isMarked ? 'border-cyan-edge bg-pure-white' : 'border-transparent bg-sky-wash-soft',
            )}
          >
            {isMarked ? (
              <>
                <span aria-hidden="true">✓ </span>
                {skill}
                <span className="sr-only"> ({markedLabel})</span>
              </>
            ) : (
              skill
            )}
          </li>
        );
      })}
    </ul>
  );
}

// .spinner: the 14px ring (the spinner-turn keyframes stay in globals.css).
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-block size-[14px] flex-none animate-[spinner-turn_700ms_linear_infinite] rounded-full border-2 border-stone-muted border-t-cyan-text',
        className,
      )}
    />
  );
}

// .eyebrow: the small uppercase label above a heading.
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 text-(length:--text-label) tracking-[0.08em] text-warm-gray uppercase">
      {children}
    </p>
  );
}

// .link
export const linkClass = 'text-cyan-text no-underline hover:text-cyan-text-strong hover:underline';

export function TextLink(props: ComponentPropsWithoutRef<'a'>) {
  return <a {...props} className={cx(linkClass, props.className)} />;
}

// .profile-panel / .upcoming-panel inside the workspace: the white rounded
// panels of the dashboard.
export const workspacePanel =
  'grid gap-16 rounded-2xl border border-stone-border bg-pure-white px-32 py-24';

// .upcoming-item + .upcoming-copy: one card of the dashboard rail, the icon
// on the left and the copy stacked on the right. The rail icon is 20px
// cyan; an svg inside the copy keeps its own look.
export function RailItem({ icon: ItemIcon, children }: { icon: Icon; children: ReactNode }) {
  return (
    <li className="flex items-start gap-12 rounded-lg border border-stone-border p-16">
      <ItemIcon className="mt-4 size-[20px] flex-none text-cyan-text" />
      <div className="grid gap-4">{children}</div>
    </li>
  );
}

// .upcoming-copy strong
export function RailTitle({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-ink-black">{children}</strong>;
}

// .upcoming-copy span
export const railText = 'text-[14px] leading-[1.6] text-warm-gray max-sm:text-[15px]';

// .status-chip: it sits in the rail copy, whose span rule outranked the
// chip's own label size, so it reads at the rail text size.
export function StatusChip({ children }: { children: ReactNode }) {
  return (
    <span
      className={cx(
        railText,
        'justify-self-start rounded-full bg-stone-canvas px-12 py-4 tracking-[0.08em] uppercase',
      )}
    >
      {children}
    </span>
  );
}

// .save-toast: the confirmation that rises in the bottom-right corner.
export function SaveToast({
  icon: ToastIcon,
  dismissLabel,
  onDismiss,
  children,
}: {
  icon: Icon;
  dismissLabel: string;
  onDismiss: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      className="fixed right-24 bottom-24 z-30 flex max-w-[min(480px,calc(100%-2*var(--spacing-24)))] animate-[toast-rise_180ms_cubic-bezier(0.16,1,0.3,1)] items-center gap-8 rounded-lg border border-cyan-text bg-pure-white px-16 py-12 font-medium text-ink-black shadow-xl motion-reduce:animate-none"
    >
      <ToastIcon className="size-[16px] flex-none text-cyan-text" />
      <p className="m-0">{children}</p>
      <button type="button" className={dismissButton} aria-label={dismissLabel} onClick={onDismiss}>
        ✕
      </button>
    </div>
  );
}

// .save-toast-dismiss: the quiet ✕.
export const dismissButton =
  'cursor-pointer border-none bg-transparent py-0 pr-0 pl-8 [font-family:inherit] [font-size:inherit] [font-weight:inherit] leading-none text-warm-gray hover:text-ink-black';

// .form-error / .form-note on an inline message (a span in an actions row).
export const inlineAlert =
  'rounded-lg border border-stone-muted px-12 py-8 text-[12px] leading-[1.6] text-soot';
export const inlineNote = 'rounded-lg px-12 py-8 text-[12px] leading-[1.6] text-warm-gray';
