import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Shell } from "@/components/Shell";
import { ReadyNotifications } from "@/components/ReadyNotifications";

export default async function WaiterLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "WAITER" && user.role !== "OWNER") redirect("/login");

  return (
    <Shell role="waiter" roleLabel="Waiter" userName={user.name}>
      <ReadyNotifications />
      {children}
    </Shell>
  );
}
