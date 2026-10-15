import { EduPilot } from "@/components/edupilot-app";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/lib/security";
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
  if (roots.includes(page[0])) {
    const h = await headers();
    const req = new Request("http://localhost/", {
      headers: { cookie: h.get("cookie") || "" },
    });
    if (!(await currentUser(req))) redirect("/login");
  }
  return (
    <Suspense fallback={<div className="boot">Загрузка EduPilot…</div>}>
      <EduPilot />
    </Suspense>
  );
}
