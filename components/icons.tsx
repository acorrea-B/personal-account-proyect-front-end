export type IconProps = {
  className?: string;
};

export function UserIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 24 24"
      width="24"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4.8 20.2a8 8 0 0 1 14.4 0" />
    </svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 24 24"
      width="24"
    >
      <path d="M12 3l7 3v6c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6l7-3Z" />
      <path d="m9.5 12 1.8 1.8 3.3-3.3" />
    </svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 24 24"
      width="24"
    >
      <rect height="13" rx="2" ry="2" width="16" x="4" y="9" />
      <path d="M8 9V7a4 4 0 0 1 8 0v2" />
      <circle cx="12" cy="15" r="1" />
    </svg>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 24 24"
      width="24"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function SignalIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 24 24"
      width="24"
    >
      <path d="M12 3a9 9 0 0 0-9 9c0 4.9 3.5 7.5 9 9 5.5-1.5 9-4.1 9-9a9 9 0 0 0-9-9Z" />
      <circle cx="12" cy="9" r="1.3" />
      <path d="M12 12v4" />
    </svg>
  );
}
