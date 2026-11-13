import { AppointmentDetailView } from "@/features/appointments/views/appointment-detail-view";
import { ChatPanel } from "@/features/chat/components/chat-panel";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AppointmentDetailView id={id} chat={<ChatPanel appointmentId={id} />} />;
}
