import { AppShell } from "../../../../components/layout/AppShell";
import { FlowTopBar } from "../../../../components/layout/FlowTopBar";
import { PageContainer } from "../../../../components/layout/PageContainer";
import { Button } from "../../../../components/ui/Button";
import { Empty } from "../../../../components/ui/Empty";
import { PlaceResultItem } from "../../../../components/ui/PlaceResultItem";
import { TextField } from "../../../../components/ui/TextField";
import type { LocalSearchResult } from "../../../../lib/local-search/dto";
import { searchLocalPlaces } from "../../../../lib/local-search/service";

/**
 * 장소 검색 — design.pen `04a Place Search - Results`와 `04b Place Search - No Result`.
 *
 * 두 프레임은 같은 화면의 두 상태라 한 라우트다. 검색어는 `?q=`로 들고 다닌다.
 * 상태를 클라이언트에 담지 않으므로 결과 화면을 그대로 공유하거나 새로고침해도
 * 같은 것이 나오고, 자바스크립트 없이도 검색이 돈다.
 *
 * 검색어가 아직 없을 때(주소창으로 바로 들어온 경우)는 비어 있는 검색창만 둔다.
 * "검색 결과가 없어요"는 찾아본 뒤에 할 말이지 시작할 때 할 말이 아니다.
 *
 * 서버 컴포넌트가 `searchLocalPlaces`를 직접 부른다. `/api/...` 라우트를 두고
 * 자기 자신에게 HTTP 요청을 보내지 않는다(CLAUDE.md).
 */
export default async function PlaceSearchPage(
  props: PageProps<"/register/place/search">,
) {
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const searched = query !== "";

  let results: LocalSearchResult[] = [];
  let failed = false;

  if (searched) {
    try {
      results = await searchLocalPlaces(query);
    } catch (reason) {
      // 네이버 에러 코드를 화면에 노출하지 않는다. 사용자가 할 수 있는 일은
      // 다시 시도뿐이고, 원인은 여기 로그에 남는다.
      console.error("[place-search] 지역검색 호출 실패", reason);
      failed = true;
    }
  }

  return (
    <AppShell tabBar={false}>
      <FlowTopBar backHref="/register/place" title="장소 검색" />

      <PageContainer
        as="main"
        width="form"
        className="flex flex-col gap-4 py-4 md:py-32"
      >
        <h1 className="hidden type-display-sm text-text-default md:block">
          장소 검색
        </h1>

        <form action="/register/place/search" method="get">
          <TextField
            name="q"
            defaultValue={query}
            leadingIcon="search"
            placeholder="장소명 또는 주소를 검색하세요"
            aria-label="장소 검색"
            autoFocus
          />
        </form>

        {failed && (
          <Empty
            icon="warning"
            title="검색을 불러오지 못했어요"
            description="잠시 후 다시 시도해 주세요."
          />
        )}

        {!failed && results.length > 0 && (
          <section aria-label="검색 결과" className="flex flex-col">
            <p className="type-label-md text-text-muted">
              검색 결과 {results.length}
            </p>
            {results.map((place, index) => (
              <PlaceResultItem
                key={`${place.name}-${index}`}
                href={selectedPlaceHref(place)}
                name={place.name}
                address={place.address}
              />
            ))}
          </section>
        )}

        {!failed && searched && results.length === 0 && (
          <>
            <Empty
              icon="search"
              title="검색 결과가 없어요"
              description="찾으시는 장소가 없다면 장소명을 직접 입력해 주세요."
            />

            {/*
              주소 없이 이름만 들고 돌아가는 길. 좌표와 주소는 넘기지 않으므로
              등록 화면이 기본값(등록 대기중 / 서울시청)을 그대로 쓴다.
              역지오코딩이 붙으면 여기서 지도로 위치를 고르게 된다.
            */}
            <form
              action="/register/place"
              method="get"
              className="flex flex-col gap-4"
            >
              <TextField
                name="name"
                label="장소명 직접 입력"
                defaultValue={query}
                placeholder="예) 숨은골목식당"
                helperText="주소 없이 장소명만 등록돼요"
                required
              />
              <Button type="submit" className="w-full">
                이 이름으로 등록하기
              </Button>
            </form>
          </>
        )}
      </PageContainer>
    </AppShell>
  );
}

/**
 * 고른 장소를 등록 화면으로 되돌리는 주소.
 *
 * 좌표가 없는 결과는 `lat`/`lng`를 아예 붙이지 않는다. 빈 값을 실어 보내면
 * 받는 쪽이 "없음"과 "0"을 구분하려고 또 한 번 판단해야 한다.
 */
function selectedPlaceHref(place: LocalSearchResult): string {
  const params = new URLSearchParams({
    name: place.name,
    address: place.address,
  });

  if (place.lat !== null && place.lng !== null) {
    params.set("lat", String(place.lat));
    params.set("lng", String(place.lng));
  }

  return `/register/place?${params.toString()}`;
}
