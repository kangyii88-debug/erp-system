import { AppShell } from "@/components/AppShell";
import { AdvertisingDashboard } from "@/components/advertising/AdvertisingUi";

export default function AdvertisingSkuPage() {
  return (
    <AppShell>
      <AdvertisingDashboard mode="sku" />
    </AppShell>
  );
}

