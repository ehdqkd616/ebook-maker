import { adminUsername, publicUser, requireUser } from "@/lib/server/auth";
import { route } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

export const GET = route(async () => {
  const user = await requireUser();
  const store = getStore();
  const credits = store.all(
    "SELECT id, delta, reason, memo, created_at createdAt FROM credit_ledger WHERE user_id = ? ORDER BY id DESC LIMIT 50",
    user.id,
  );
  return { user: publicUser(user), creditBalance: store.creditBalance(user.id), credits, passwordManaged: user.username === adminUsername() };
});
