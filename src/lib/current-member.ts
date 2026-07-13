import "server-only";
import { redirect } from "next/navigation";
import { getCurrentMember, type SessionMember } from "./session";
import { AuthorizationError } from "./authorization";

/** For use in server actions/pages that require a logged-in, active member. */
export async function requireCurrentMember(): Promise<SessionMember> {
  const member = await getCurrentMember();
  if (!member) {
    redirect("/login");
  }
  if (!member.active) {
    throw new AuthorizationError("Your account has been deactivated. Contact an admin.");
  }
  return member;
}

/** Like requireCurrentMember but redirects instead of throwing for use at the top of pages. */
export async function requireCurrentMemberOrRedirect(): Promise<SessionMember> {
  const member = await getCurrentMember();
  if (!member || !member.active) {
    redirect("/login");
  }
  return member;
}
