import { AppShell } from "@/components/AppShell";
import { AdvertisingDashboard } from "@/components/advertising/AdvertisingUi";

export default function AdvertisingDailyPage() {
  return (
    <AppShell>
      <AdvertisingDashboard mode="daily" />
    </AppShell>
  );
}

