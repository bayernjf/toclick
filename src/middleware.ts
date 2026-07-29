import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // 刷新 Auth session，同步 cookie
  const { response } = await updateSession(request);
  return response;
}

export const config = {
  matcher: [
    // 排除静态资源和图片
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
