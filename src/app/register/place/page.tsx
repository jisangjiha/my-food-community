import { AppShell } from "../../../components/layout/AppShell";
import { FlowTopBar } from "../../../components/layout/FlowTopBar";
import { PageContainer } from "../../../components/layout/PageContainer";
import { PlaceLocationPicker } from "../../../components/places/PlaceLocationPicker";
import { TextField } from "../../../components/ui/TextField";
import { parseLatLng } from "../../../lib/local-search/parse";
import { SEOUL_CITY_HALL } from "../../../lib/maps/constants";
import { NAVER_MAP_CLIENT_ID } from "../../../lib/maps/env";
import { PLACE_PENDING_ADDRESS } from "../../../lib/places/dto";
import { readReturnTo } from "../../../lib/places/location";
import { reverseGeocode } from "../../../lib/reverse-geocode/service";

/**
 * 장소 등록 — design.pen `04 Place Register - Location`.
 *
 * 맛집 등록의 "장소 입력하기"에서 들어와, 고른 위치를 확인하고 되돌아가는 화면이다.
 * 장소 검색에서 고른 결과가 `?name`·`?address`·`?lat`·`?lng`로 실려 온다.
 *
 * 상단 검색창은 장식이 아니라 진짜 폼이다. 입력하고 넘기면 `/register/place/search`로
 * 이동한다. 시안이 그린 것과 같은 `TextField`이므로 상태(포커스·에러)도 그대로 따라간다.
 *
 * 없는 값은 기본값 한 벌로 메운다 — 지도는 서울시청. 주소가 실려 오지 않았으면
 * 여기서 리버스 지오코딩으로 채운다. 검색 결과가 없어 이름만 직접 입력하고
 * 돌아온 경우가 이 규칙에 그대로 얹힌다.
 *
 * 최초 조회를 클라이언트가 아니라 여기서 하는 이유: 서버 컴포넌트는 BFF 계층
 * 함수를 직접 부를 수 있고, 그러면 화면이 처음부터 주소를 갖고 그려진다.
 * 마운트 후에 부르면 왕복이 하나 늘고 주소 자리가 한 번 비어 보인다.
 *
 * 지도와 카드는 `PlaceLocationPicker`가 함께 소유한다. 지도를 움직이면 주소가
 * 따라 바뀌어야 하므로 둘의 상태 주인이 하나여야 한다.
 *
 * "이 위치로 등록하기"는 `PlaceLocationPicker` 안에 있다. 드래그로 바뀐 위치를
 * 아는 것이 그 컴포넌트뿐이라, 서버가 그린 링크로는 옛 좌표를 넘기게 된다.
 */
export default async function PlaceRegisterPage(
  props: PageProps<"/register/place">,
) {
  const { name, address, lat, lng, returnTo } = await props.searchParams;

  const selectedName = typeof name === "string" ? name.trim() : "";
  // 검색으로 들어왔는지의 판정 기준은 `?address`가 비어 있지 않은지 하나다.
  const providedAddress = typeof address === "string" ? address.trim() : "";
  // 좌표는 URL로 들어오므로 손으로 고쳐 넣을 수 있다. 검색 결과와 같은 잣대로 검증한다.
  const center = parseLatLng(lat, lng) ?? SEOUL_CITY_HALL;
  const initialAddress =
    providedAddress !== ""
      ? providedAddress
      : await resolveAddress(center.lat, center.lng);
  // 사용자가 URL에 무엇이든 넣을 수 있으므로 내부 경로만 통과시킨다.
  const backTo = readReturnTo(returnTo, "/register");
  const isEditing = backTo !== "/register";

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
        <PlaceLocationPicker
          initialName={selectedName}
          initialAddress={initialAddress}
          initialCenter={center}
          clientId={NAVER_MAP_CLIENT_ID}
          returnTo={backTo}
          confirmLabel={isEditing ? "이 위치로 변경하기" : "이 위치로 등록하기"}
        />
      </PageContainer>
    </AppShell>
  );
}

/**
 * 좌표 → 지번주소. 실패하면 기본 문구로 물러선다.
 *
 * 여기서 던지면 지도를 고르는 화면 전체가 죽는다. 주소는 이 화면의 한 조각일
 * 뿐이고, 주소를 못 얻어도 지도를 움직여 다시 시도할 수 있다. 원인은 로그에 남긴다.
 */
async function resolveAddress(lat: number, lng: number): Promise<string> {
  try {
    const { address } = await reverseGeocode(lat, lng);
    return address ?? PLACE_PENDING_ADDRESS;
  } catch (reason) {
    console.error("[place-register] 최초 주소 조회 실패", reason);
    return PLACE_PENDING_ADDRESS;
  }
}
