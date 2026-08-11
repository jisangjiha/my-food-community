import Link from "next/link";
import { redirect } from "next/navigation";

import { Icon } from "../../../components/foundation/Icon";
import { AppShell } from "../../../components/layout/AppShell";
import { PageContainer } from "../../../components/layout/PageContainer";
import { ProfileEditForm } from "../../../components/profile/ProfileEditForm";
import { getCurrentUser } from "../../../lib/auth/session";
import { getMyProfile } from "../../../lib/profile/service";

/**
 * 프로필 수정.
 *
 * 서버 컴포넌트라 서비스 함수를 그대로 부른다. 자기 앱의 `/api/me/profile`을
 * fetch 하면 왕복이 하나 늘고 쿠키를 다시 실어 보내야 한다. 그 라우트는 저장할
 * 때(PATCH) 폼이 쓴다.
 *
 * proxy가 비로그인 접근을 이미 `/login`으로 돌리지만 여기서 한 번 더 확인한다.
 * 인가를 프록시 한 겹에만 기대지 않는다.
 */
export default async function ProfileEditPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/my/edit")}`);
  }

  const profile = await getMyProfile(user);

  return (
    // 폼만 있는 화면이라 하단 탭은 내린다. 등록 화면과 같은 규칙이다.
    <AppShell tabBar={false}>
      {/* Phone top bar — replaced by SiteHeader from md. */}
      <div className="sticky top-0 z-30 border-b border-border-default bg-background-surface md:hidden">
        <div className="flex h-14 items-center justify-between px-3">
          <Link
            href="/my"
            aria-label="닫기"
            className="flex size-6 items-center justify-center text-text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
          >
            <Icon name="close" size={24} />
          </Link>
          <h1 className="type-heading-sm text-text-default">프로필 수정</h1>
          {/* 오른쪽 자리를 비워 두면 제목이 가운데에서 밀린다. */}
          <span className="size-6" aria-hidden />
        </div>
      </div>

      <PageContainer
        as="main"
        width="form"
        className="flex flex-col gap-4 py-4 md:py-32"
      >
        <div className="hidden flex-col gap-px md:flex">
          <span className="type-label-md text-text-brand">{profile.handle}</span>
          <h1 className="type-display-sm text-text-default">프로필 수정</h1>
        </div>

        <ProfileEditForm profile={profile} />
      </PageContainer>
    </AppShell>
  );
}
