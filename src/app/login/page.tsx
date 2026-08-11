import Image from "next/image";

import { Icon } from "../../components/foundation/Icon";
import { GoogleLoginButton } from "../../components/ui/GoogleLoginButton";

/**
 * 로그인 실패 문구.
 *
 * BFF가 붙여 보내는 코드만 문구로 바꾼다. 알 수 없는 값이 오면 아무것도 띄우지
 * 않는다. 쿼리스트링은 누구나 조작할 수 있으므로, 여기 없는 코드는 무시한다.
 */
const SIGN_IN_ERRORS: Record<string, { title: string; description: string }> = {
  oauth_denied: {
    title: "로그인이 취소됐어요",
    description: "Google 계정 선택 화면에서 다시 시도해 주세요.",
  },
  oauth_start_failed: {
    title: "로그인을 시작하지 못했어요",
    description: "잠시 후 다시 시도해 주세요.",
  },
  exchange_failed: {
    title: "로그인을 마치지 못했어요",
    description: "링크가 만료됐을 수 있어요. 다시 시도해 주세요.",
  },
  missing_code: {
    title: "로그인 정보가 없어요",
    description: "처음부터 다시 로그인해 주세요.",
  },
};

/**
 * 로그인 — the only screen with no app chrome, since it is pre-auth.
 *
 * Phone and tablet follow design.pen exactly: hero photo on top, copy and the
 * Google control below. From lg the two halves sit side by side inside the
 * 1280 cap, so a wide window gets a composed split rather than a tall ribbon.
 */
export default async function LoginPage(props: PageProps<"/login">) {
  // proxy가 보호 경로에서 튕겨낼 때 원래 가려던 곳을 `next`로 넘겨 준다.
  // 로그인 시작 라우트까지 그대로 전달해 콜백이 제자리로 돌려보내게 한다.
  const { next, error } = await props.searchParams;
  const target = typeof next === "string" ? next : "/";
  const signInHref = `/auth/signin/google?next=${encodeURIComponent(target)}`;
  const failure = typeof error === "string" ? SIGN_IN_ERRORS[error] : undefined;

  return (
    <main className="flex flex-1 flex-col bg-background-canvas lg:mx-auto lg:w-full lg:max-w-[1280px] lg:flex-row lg:items-stretch lg:gap-[48px] lg:px-32 lg:py-32">
      <div className="relative h-[380px] shrink-0 overflow-hidden rounded-b-[28px] lg:h-auto lg:flex-1 lg:rounded-[28px]">
        <Image
          src="/images/login-hero.png"
          alt=""
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
          priority
        />
        <span className="absolute bottom-20 left-20 flex items-center gap-[6px] rounded-full bg-white/90 px-12 py-[6px]">
          {/*
            design.pen draws the 16px heart component scaled to 14. The icon
            scale only has 16/20/24/32, so the badge uses 16 rather than
            introducing an off-scale size.
          */}
          <span className="text-text-brand" aria-hidden>
            <Icon name="heart" size={16} />
          </span>
          <span className="type-label-md text-text-brand-strong">
            이웃이 직접 다녀온 곳
          </span>
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-32 px-24 pb-[28px] pt-32 lg:max-w-[440px] lg:justify-center lg:px-0 lg:py-0">
        <div className="flex flex-col gap-12">
          <span className="type-label-md text-text-brand">숨은맛집</span>
          <h1 className="type-display-sm whitespace-pre-line text-text-default lg:type-display-md">
            {"숨은 맛집을\n이웃과 함께"}
          </h1>
          <p className="type-body-lg text-text-muted">
            광고 없는 이웃 추천으로 오늘의 특별한 한 끼를 찾아보세요.
          </p>
        </div>

        <div className="flex flex-col items-center gap-16">
          {failure && (
            /* 등록 화면의 오류 배너와 같은 모양. 실패 문구가 화면마다 다르게
               생기지 않도록 마크업을 맞춰 둔다. */
            <div
              className="flex w-full gap-2 rounded-2xl border border-border-error-subtle bg-background-error p-3"
              role="alert"
            >
              <span className="shrink-0 text-text-error" aria-hidden>
                <Icon name="error" size={20} />
              </span>
              <div className="flex flex-col gap-0.5">
                <p className="type-label-lg text-text-error">{failure.title}</p>
                <p className="type-label-md text-text-muted">
                  {failure.description}
                </p>
              </div>
            </div>
          )}

          <GoogleLoginButton href={signInHref} />
          <p className="max-w-[280px] text-center type-label-md text-text-subtle">
            계속 진행하면 서비스 약관과 개인정보처리방침에 동의하게 됩니다.
          </p>
        </div>
      </div>
    </main>
  );
}
