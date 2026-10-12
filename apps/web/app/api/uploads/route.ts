import { requireUser } from "@/lib/server/auth";
import { readJson, route } from "@/lib/server/http";
import { getLimits } from "@/lib/server/limits";
import { saveImage, saveMedia } from "@/lib/server/uploads";

export const POST = route(async (req) => {
  const user = await requireUser();
  getLimits().upload.check(`user:${user.id}`);
  const { dataUrl } = await readJson(req);
  return typeof dataUrl === "string" && /^data:(audio|video)\//.test(dataUrl) ? saveMedia(dataUrl) : saveImage(dataUrl);
});
