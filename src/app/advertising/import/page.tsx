import { AppShell } from "@/components/AppShell";
import { AdvertisingDashboard } from "@/components/advertising/AdvertisingUi";

export default function AdvertisingImportPage() {
  return (
    <AppShell>
      <AdvertisingDashboard mode="import" />
    </AppShell>
  );
}

