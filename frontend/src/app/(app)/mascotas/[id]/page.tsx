import { PetDetailView } from "@/features/pets";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PetDetailView id={id} />;
}
