"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * 로그아웃. 상태를 바꾸므로 GET 라우트가 아니라 서버 액션으로 둔다.
 * (`<form action={signOut}>`로 붙이면 POST가 되고, Next.js가 CSRF 토큰을 붙인다.)
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // 세션에 따라 달라지는 화면이 캐시에 남지 않도록 비운다.
  revalidatePath("/", "layout");
  redirect("/login");
}
