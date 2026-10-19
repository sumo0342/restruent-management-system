import { redirect } from "next/navigation";

export default async function ForgotPasswordPage() {
  redirect("/login");
}
