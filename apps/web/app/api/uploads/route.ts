import { requireUser } from "@/lib/server/auth";
import { readJson, route } from "@/lib/server/http";
import { getLimits } from "@/lib/server/limits";
import { saveImage } from "@/lib/server/uploads";

export const POST = route(async (req) => {
  const user = await requireUser();
  getLimits().upload.check(`user:${user.id}`);
  return saveImage((await readJson(req)).dataUrl);
});
