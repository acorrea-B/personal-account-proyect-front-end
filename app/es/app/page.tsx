import { DashboardView } from '@/components/dashboard-view';

// The spanish workspace route: the shared view speaks this dictionary and
// carries the same feature set as the english one (the drift mirror is
// retired).
export default function AppEsPage() {
  return <DashboardView locale="es" />;
}
