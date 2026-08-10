import { AppShell } from "../../../components/layout/AppShell";
import { FlowTopBar } from "../../../components/layout/FlowTopBar";
import { PageContainer } from "../../../components/layout/PageContainer";
import { ButtonLink } from "../../../components/ui/ButtonLink";
import { Card } from "../../../components/ui/Card";
import { NaverMap } from "../../../components/ui/NaverMap";
import { TextField } from "../../../components/ui/TextField";
import { parseLatLng } from "../../../lib/local-search/parse";
import { NAVER_MAP_CLIENT_ID } from "../../../lib/maps/env";
import { PLACE_PENDING_ADDRESS } from "../../../lib/places/dto";

/**
 * 장소 등록 — design.pen `04 Place Register - Location`.
 *
 * 맛집 등록의 "장소 입력하기"에서 들어와, 고른 위치를 확인하고 되돌아가는 화면이다.
 * 장소 검색에서 고른 결과가 `?name`·`?address`·`?lat`·`?lng`로 실려 온다.
 *
 * 상단 검색창은 장식이 아니라 진짜 폼이다. 입력하고 넘기면 `/register/place/search`로
 * 이동한다. 시안이 그린 것과 같은 `TextField`이므로 상태(포커스·에러)도 그대로 따라간다.
 *
 * 없는 값은 기본값 한 벌로 메운다 — 주소는 `PLACE_PENDING_ADDRESS`, 지도는
 * 서울시청. 검색 결과가 없어 이름만 직접 입력하고 돌아온 경우가 이 규칙에
 * 그대로 얹힌다. 별도 분기가 없다.
 *
 * 맛집 등록 폼 자체가 아직 배선 전이라(사진·이름·주소 어느 것도 저장되지 않는다),
 * "이 위치로 등록하기"는 고른 장소를 들고 돌아가지 않고 등록 화면으로만 돌아간다.
 * 폼에 상태가 생기는 시점에 같이 이어 붙일 자리다.
 */
export default async function PlaceRegisterPage(
  props: PageProps<"/register/place">,
) {
  const { name, address, lat, lng } = await props.searchParams;

  const selectedName = typeof name === "string" ? name.trim() : "";
  const selectedAddress =
    typeof address === "string" && address.trim() !== ""
      ? address.trim()
      : PLACE_PENDING_ADDRESS;
  // 좌표는 URL로 들어오므로 손으로 고쳐 넣을 수 있다. 검색 결과와 같은 잣대로 검증한다.
  const center = parseLatLng(lat, lng);

  return (
    <AppShell tabBar={false}>
      <FlowTopBar backHref="/register" title="장소 등록" />

      {/* 고르는 화면이라 폼 폭(640)에서 멈춘다. */}
      <PageContainer
        as="main"
        width="form"
        className="flex flex-col gap-4 py-4 md:py-32"
      >
        <h1 className="hidden type-display-sm text-text-default md:block">
          장소 등록
        </h1>

        {/* GET 폼이라 자바스크립트 없이도 검색 화면으로 넘어간다. */}
        <form action="/register/place/search" method="get">
          <TextField
            name="q"
            defaultValue={selectedName}
            leadingIcon="search"
            placeholder="장소명 또는 주소를 검색하세요"
            aria-label="장소 검색"
          />
        </form>

        {/*
          키는 서버에서만 읽어 prop으로 내려간다. 브라우저로 나가는 지점이 이
          한 줄뿐이라, 키가 어디로 새는지 grep 한 번으로 알 수 있다.
        */}
        <NaverMap
          label={selectedName !== "" ? selectedName : "장소 선택"}
          clientId={NAVER_MAP_CLIENT_ID}
          center={center ?? undefined}
        />

        <Card>
          <p className="type-label-md text-text-brand">선택한 위치</p>
          <h2 className="type-heading-md text-text-default">
            {selectedName !== "" ? selectedName : "장소를 선택해 주세요"}
          </h2>
          <p className="type-body-lg text-text-muted">{selectedAddress}</p>
        </Card>

        <ButtonLink href="/register" className="w-full">
          이 위치로 등록하기
        </ButtonLink>
      </PageContainer>
    </AppShell>
  );
}
