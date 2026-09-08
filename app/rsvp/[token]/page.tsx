import RSVP from '@/components/planner/rsvp';
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <RSVP token={token} />;
}
