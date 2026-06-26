import { AppShell } from "@/components/AppShell";
import { AdvertisingDashboard } from "@/components/advertising/AdvertisingUi";

export default function AdvertisingRulesPage() {
  return (
    <AppShell>
      <AdvertisingDashboard mode="rules" />
    </AppShell>
  );
}
