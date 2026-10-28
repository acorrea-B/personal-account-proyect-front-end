import { ProfileView } from '@/components/profile-view';

// The spanish profile route: the shared view speaks this dictionary —
// the route the dashboard and the account menu already pointed at without
// a page behind it. The mirror-in-a-file pattern is not resurrected: the
// editor lives once, in the shared view.
export default function ProfileEsPage() {
  return <ProfileView locale="es" />;
}
