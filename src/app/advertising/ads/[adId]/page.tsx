import { AppShell } from "@/components/AppShell";
import { AdvertisingDetailPage } from "@/components/advertising/AdvertisingUi";

export default function AdvertisingAdDetail({ params }: { params: { adId: string } }) {
  return (
    <AppShell>
      <AdvertisingDetailPage adId={params.adId} />
    </AppShell>
  );
}

