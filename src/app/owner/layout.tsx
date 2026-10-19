import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Shell } from "@/components/Shell";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "OWNER") redirect("/login");

  return (
    <Shell role="owner" roleLabel="Owner" userName={user.name}>
      {children}
    </Shell>
  );
}
