import PublicEvent from '@/components/planner/public-event';

export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <PublicEvent eventId={eventId} />;
}
