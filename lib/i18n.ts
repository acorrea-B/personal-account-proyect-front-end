// The i18n dictionary: every user-facing string of the shared components,
// keyed per locale. The components take a `locale` prop (the trees own the
// locale) and read their labels from here - the strings live in one place,
// the trees stay thin.
export type Locale = 'en' | 'es';

export type Labels = {
  account: string;
  updateProfile: string;
  signOut: string;
  language: string;
  cvCard: {
    title: string;
    live: string;
    lastSaved: string;
    edit: string;
    empty: string;
    write: string;
    retry: string;
  };
  history: {
    title: string;
    empty: string;
    retry: string;
    viewLabel: string;
  };
  versionDetail: {
    eyebrow: string;
    viewHeading: string;
    viewFallback: string;
    origin: string;
    restore: string;
    restored: string;
    restoredNote: string;
    close: string;
    dismiss: string;
  };
  panel: {
    eyebrow: string;
    fullName: string;
    headline: string;
    bio: string;
    location: string;
    skills: string;
    links: string;
    updatedNote: string;
    updateLink: string;
    comingUp: string;
    liveCard: string;
  };
  clampedText: {
    showMore: string;
    showLess: string;
  };
};

export function tr(template: string, vars: Record<string, string> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? vars[key] : match));
}

const strings: Record<Locale, Labels> = {
  en: {
    account: 'Account',
    updateProfile: 'Update profile',
    signOut: 'Sign out',
    language: 'Language',
    cvCard: {
      title: 'CV',
      live: 'Live',
      lastSaved: 'Last saved {date}',
      edit: 'Edit CV',
      empty: 'No cv yet — write yours in the editor.',
      write: 'Write your CV',
      retry: 'Try again',
    },
    history: {
      title: 'Version history',
      empty: 'No archived versions yet — save the cv to start the history.',
      retry: 'Try again',
      viewLabel: 'View the version archived {date}',
    },
    versionDetail: {
      eyebrow: 'Version history · archived',
      viewHeading: 'Version from {date}',
      viewFallback: 'Version',
      origin: 'origin {origin}',
      restore: 'Restore this version',
      restored: 'Version restored — it is now the current cv.',
      restoredNote: 'Cv saved — the previous version moved to the history when there was one.',
      close: 'Close',
      dismiss: 'Dismiss the saved confirmation',
    },
    panel: {
      eyebrow: 'Profile',
      fullName: 'Full name',
      headline: 'Headline',
      bio: 'Bio',
      location: 'Location',
      skills: 'Skills',
      links: 'Links',
      updatedNote: 'Updated {date}',
      updateLink: 'Update profile',
      comingUp: 'Coming up',
      liveCard: 'Profile',
    },
    clampedText: {
      showMore: 'Show more',
      showLess: 'Show less',
    },
  },
  es: {
    account: 'Cuenta',
    updateProfile: 'Actualizar perfil',
    signOut: 'Cerrar sesión',
    language: 'Idioma',
    cvCard: {
      title: 'CV',
      live: 'En vivo',
      lastSaved: 'Guardado el {date}',
      edit: 'Editar CV',
      empty: 'Aún no hay CV — escríbelo en el editor.',
      write: 'Escribe tu CV',
      retry: 'Intentar de nuevo',
    },
    history: {
      title: 'Historial de versiones',
      empty: 'Aún no hay versiones archivadas — guarda el CV para empezar el historial.',
      retry: 'Intentar de nuevo',
      viewLabel: 'Ver la versión archivada el {date}',
    },
    panel: {
      eyebrow: 'Perfil',
      fullName: 'Nombre',
      headline: 'Titular',
      bio: 'Bio',
      location: 'Ubicación',
      skills: 'Habilidades',
      links: 'Enlaces',
      updatedNote: 'Actualizado el {date}',
      updateLink: 'Actualizar perfil',
      comingUp: 'Lo que viene',
      liveCard: 'Perfil',
    },
    clampedText: {
      showMore: 'Mostrar más',
      showLess: 'Mostrar menos',
    },
    versionDetail: {
      eyebrow: 'Historial de versiones · archivada',
      viewHeading: 'Versión del {date}',
      viewFallback: 'Versión',
      origin: 'origen {origin}',
      restore: 'Restaurar esta versión',
      restored: 'Versión restaurada — ahora es la vigente.',
      restoredNote: 'CV guardado — la versión anterior pasó al historial.',
      close: 'Cerrar',
      dismiss: 'Descartar la confirmación de guardado',
    },
  },
};

export function labels(locale: Locale | undefined): Labels {
  return locale === 'es' ? strings.es : strings.en;
}

// Resolves a user agent language tag to a supported locale; unknown tags
// degrade to english (the account entry point's default).
export function resolveLocale(input?: string | null): Locale {
  const normalized = (input ?? 'en').toLowerCase();
  return normalized.startsWith('es') ? 'es' : 'en';
}
