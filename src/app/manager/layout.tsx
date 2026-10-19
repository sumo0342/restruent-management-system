import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Shell } from "@/components/Shell";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "MANAGER" && user.role !== "OWNER") redirect("/login");

  return (
    <Shell role="manager" roleLabel="Manager" userName={user.name}>
      {children}
    </Shell>
  );
}
