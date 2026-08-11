"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { IconButton } from "../../components/ui/IconButton";
import { Toast } from "../../components/ui/Toast";

/**
 * 카드 위의 삭제 버튼.
 *
 * 마이 페이지는 서버 컴포넌트라 데이터를 직접 서비스에서 읽지만, 삭제는 사용자
 * 조작이라 브라우저에서 일어난다. 그래서 이 조각만 클라이언트다. 호출하는 곳은
 * BFF 라우트 하나(`DELETE /api/places/{id}`)이고, Supabase는 여기서 보이지 않는다.
 *
 * 지운 뒤에는 `router.refresh()`로 서버 컴포넌트를 다시 그린다. 목록을 클라이언트
 * 상태로 따로 들고 있으면 카드 수와 위의 "등록" 숫자가 어긋나는 순간이 생긴다.
 * 한 번 다시 그리면 둘 다 같은 응답에서 나온다.
 */
export function DeletePlaceButton({
  id,
  title,
}: {
  id: string;
  /** 버튼 이름에 넣는다. 카드가 여러 개라 "삭제"만으로는 어느 것인지 모른다. */
  title: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  const busy = sending || refreshing;

  async function handleDelete() {
    setError(null);
    setSending(true);

    try {
      const response = await fetch(`/api/places/${id}`, { method: "DELETE" });

      if (!response.ok) {
        // BFF는 실패를 항상 { error: { code, message } }로 준다. 그 문구를 그대로
        // 보여준다. 여기서 다시 지어내면 서버가 아는 이유가 화면에서 사라진다.
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "삭제하지 못했습니다.");
        setSending(false);
        return;
      }

      // 성공하면 이 컴포넌트는 곧 사라진다. sending을 되돌리지 않아 그 사이
      // 다시 눌리는 일이 없다.
      startRefresh(() => router.refresh());
    } catch {
      setError("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setSending(false);
    }
  }

  return (
    <>
      <IconButton
        name="close"
        label={`${title} 삭제`}
        variant="circle-neutral"
        size={28}
        iconSize={16}
        disabled={busy}
        onClick={handleDelete}
        // 카드 전체가 링크라 그 위에 겹쳐 놓는다. 버튼을 링크 안에 넣으면
        // 클릭이 링크로도 전달되고 마크업도 잘못된다.
        className="absolute right-1.5 top-1.5 z-10 shadow-sm"
      />

      {error && (
        <Toast
          variant="error"
          onClose={() => setError(null)}
          className="fixed inset-x-4 bottom-4 z-50 md:left-auto md:right-6 md:w-[400px]"
        >
          {error}
        </Toast>
      )}
    </>
  );
}
