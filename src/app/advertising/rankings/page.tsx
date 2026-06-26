import { AppShell } from "@/components/AppShell";
import { AdvertisingDashboard } from "@/components/advertising/AdvertisingUi";

export default function AdvertisingRankingsPage() {
  return (
    <AppShell>
      <AdvertisingDashboard mode="rankings" />
    </AppShell>
  );
}

