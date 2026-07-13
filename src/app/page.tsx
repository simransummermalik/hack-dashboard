import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/session";

export default async function RootPage() {
  const member = await getCurrentMember();
  redirect(member ? "/dashboard" : "/login");
}
