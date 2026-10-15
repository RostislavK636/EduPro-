import { EduPilot } from "@/components/edupilot-app";
import { Suspense } from "react";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ page?: string[] }>;
}) {
  const { page = [] } = await params;
  const roots = [
    "workspace",
    "tools",
    "materials",
    "classes",
    "chat",
    "settings",
    "help",
    "quiz",
    "learning",
  ];
  if (page[0] && !["login", "register", ...roots].includes(page[0])) notFound();
  return (
    <Suspense fallback={<div className="boot">Загрузка EduPilot…</div>}>
      <EduPilot />
    </Suspense>
  );
}
