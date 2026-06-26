import { AppShell } from "@/components/AppShell";
import { AdvertisingDashboard } from "@/components/advertising/AdvertisingUi";

export default function AdvertisingNotesPage() {
  return (
    <AppShell>
      <AdvertisingDashboard mode="notes" />
    </AppShell>
  );
}

