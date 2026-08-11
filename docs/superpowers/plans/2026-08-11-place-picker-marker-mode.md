# 마커 모드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 검색으로 고른 장소를 지도 좌표에 못 박아, 지도를 움직이거나 확대해도 선택이 유지되게 한다.

**Architecture:** `NaverMap`에 `variant="marker"`를 더해 세 모드로 가른다. `PlaceLocationPicker`는 `name`의 유무로 모드를 파생시키고, 마커 모드에서는 `onCenterChange`를 넘기지 않아 리스너 자체가 달리지 않는다.

**Tech Stack:** Next.js 16.2.12, React 19.2.4, TypeScript 5, `@types/navermaps` 3.9.2

설계 문서: `docs/superpowers/specs/2026-08-11-place-picker-marker-mode-design.md`

## Global Constraints

- 테스트 러너가 없다. 검증은 `npx tsc --noEmit`, `npm run lint`, Storybook, 브라우저.
- `src/components/ui/*`를 재사용한다. 신규 UI 프리미티브를 만들지 않는다.
- 색상·타이포·스페이싱은 토큰만.
- 컴포넌트 API를 바꾸면 스토리를 같이 갱신한다.
- 커밋 메시지는 한국어.
- 브랜치는 `feat/naver-reverse-geocoding`.
- 모드 판정 규칙은 전 태스크 공통: `name !== ""` → `marker`, `name === ""` → `picker`.

## 파일 구조

| 파일 | 상태 | 책임 | Task |
| --- | --- | --- | --- |
| `src/components/ui/NaverMap.tsx` | 수정 | `variant="marker"`, 리스너를 picker 전용으로 | 1 |
| `src/stories/ui/Handoff.stories.tsx` | 수정 | `marker` 스토리 | 1 |
| `src/components/places/PlaceLocationPicker.tsx` | 수정 | 모드 분기 + 전환 버튼 | 2 |

---

### Task 1: NaverMap에 마커 모드 추가

**Files:**
- Modify: `src/components/ui/NaverMap.tsx`
- Modify: `src/stories/ui/Handoff.stories.tsx`

**Interfaces:**
- Produces: `NaverMapProps.variant?: "picker" | "marker" | "static"`

- [ ] **Step 1: variant 타입과 주석을 넓힌다**

`NaverMapProps`의 `variant` 주석과 타입을 바꾼다:

```ts
  /**
   * `picker`는 위치를 고르는 지도다 — 중앙에 고정된 핀 아래로 지도가 흐르고,
   * 드래그·줌으로 위치를 옮긴다.
   *
   * `marker`는 이미 고른 장소를 확인하는 지도다. 좌표에 마커를 못 박고 지도는
   * 자유롭게 움직인다. 중심을 보고하지 않으므로 아무리 끌어도 고른 장소가
   * 바뀌지 않는다 — 건물이 맞는지 둘러보려고 확대한 사용자가 확인 대상을 잃지
   * 않는다.
   *
   * `static`은 조작까지 막은 읽기 전용이다. 상세 화면의 미니지도가 이것이다.
   */
  variant?: "picker" | "marker" | "static";
```

- [ ] **Step 2: initMap의 분기를 셋으로 고친다**

`initMap` 안의 `const interactive = variant === "picker";`를 두 값으로 나눈다:

```ts
    const interactive = variant !== "static";
    const isPicker = variant === "picker";
    const position = new naver.maps.LatLng(lat, lng);
```

마커·리스너 블록을 바꾼다. 기존 `if (!interactive) { … marker … return; }` 이후 전체를
이것으로 대체한다:

```ts
    // 마커는 picker가 아닌 두 모드에 있다. picker의 핀이 마커가 아닌 이유는 위
    // 주석에 있다 — 마커는 좌표에 붙어 지도와 함께 움직이는데, 위치를 고르는
    // 화면에 필요한 동작은 그 반대다.
    if (!isPicker) {
      markerRef.current = new naver.maps.Marker({ position, map });
      // 중심을 보고하지 않는다. 이것이 마커 모드의 존재 이유다.
      return;
    }

    // 줌은 위치를 바꾸려는 조작이 아니라 확인하려는 조작이다. 그런데 휠·핀치
    // 줌은 커서 쪽으로 확대하느라 중심을 옮긴다. 그대로 두면 고른 가게가 풀리고
    // 주소가 옆 번지로 바뀌어, 정작 "이 건물이 맞나" 확인하려고 확대한 사용자가
    // 확인할 대상을 잃는다. 줌으로 밀린 중심은 되돌린다.
    //
    // marker 모드에는 걸지 않는다. 거기서는 중심에 아무 의미가 없다.
    zoomListenerRef.current = naver.maps.Event.addListener(
      map,
      "zoom_changed",
      () => {
        const pinned = lastReportedRef.current;
        map.setCenter(new naver.maps.LatLng(pinned.lat, pinned.lng));
      },
    );

    lastReportedRef.current = { lat, lng };

    listenerRef.current = naver.maps.Event.addListener(map, "idle", () => {
      // … 기존 내용 그대로 …
    });
```

주의: 기존 코드에서 `lastReportedRef.current = { lat, lng };`는 zoom 리스너 위에 있다.
순서를 위와 같이 맞춘다(zoom 리스너가 그 값을 읽으므로 먼저 대입해도 무방하나,
읽는 시점은 이벤트 발생 시라 어느 쪽이든 동작한다).

- [ ] **Step 3: 중앙 핀 조건을 고친다**

렌더의 `{variant === "picker" && <CenterPin size={size} />}`는 그대로 두면 된다 —
`marker`와 `static` 모두 중앙 핀이 없어야 하므로 이미 맞다. 확인만 한다.

`aria-label`도 확인한다. 현재 `variant === "picker" ? "장소 선택 지도" : \`${label} 위치 지도\``
이므로 `marker`는 "예빈당 성수본점 위치 지도"가 된다 — 맞는 문구다.

- [ ] **Step 4: 타입·린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 둘 다 출력 없이 종료(코드 0)

- [ ] **Step 5: 스토리를 추가한다**

`Handoff.stories.tsx`의 `NaverMapFallback` 안, `static` Specimen 아래에 넣는다:

```tsx
      <Specimen
        label="marker — 고른 장소 확인 (폴백)"
        description="variant=marker는 좌표에 마커를 못 박고 지도는 자유롭게 움직입니다. 중심을 보고하지 않아 아무리 끌어도 선택이 바뀌지 않습니다."
      >
        <div className="w-[328px]">
          <NaverMap
            label="예빈당 성수본점"
            clientId={null}
            variant="marker"
            size="lg"
          />
        </div>
      </Specimen>
```

- [ ] **Step 6: 커밋**

```bash
git add src/components/ui/NaverMap.tsx src/stories/ui/Handoff.stories.tsx
git commit -m "feat: NaverMap에 marker 변형 추가"
```

---

### Task 2: 선택 화면의 모드 분기

**Files:**
- Modify: `src/components/places/PlaceLocationPicker.tsx`

**Interfaces:**
- Consumes: Task 1의 `variant="marker"`
- Produces: 없음 (화면 동작)

- [ ] **Step 1: 모드를 파생시킨다**

`const imageCount…`가 없는 파일이다. `handleCenterChange` 선언 **위**에 넣는다:

```ts
  /**
   * 검색으로 고른 장소가 있으면 지도에 못 박는다.
   *
   * 별도 상태를 두지 않는 이유: `name`이 이미 "검색으로 고른 장소인가"를 뜻한다.
   * 상태를 하나 더 두면 둘이 어긋나는 조합이 생긴다.
   */
  const pinned = name !== "";
```

- [ ] **Step 2: 지도에 모드를 넘긴다**

`<NaverMap …>`을 바꾼다:

```tsx
      <NaverMap
        label={name !== "" ? name : "장소 선택"}
        clientId={clientId}
        center={initialCenter}
        variant={pinned ? "marker" : "picker"}
        onCenterChange={pinned ? undefined : handleCenterChange}
      />
```

`center`는 그대로 `initialCenter`다. 마커 모드에서 지도를 움직여도 마커는 이 좌표에
있고, 핀 모드로 바꿔도 지도는 움직이지 않으므로 화면이 튀지 않는다.

- [ ] **Step 3: 전환 버튼을 카드에 넣는다**

`Card` 안, 주소 `<p>`(또는 `Skeleton`) **아래**에 넣는다:

```tsx
        {pinned && (
          <Button
            type="button"
            variant="secondary"
            leadingIcon="edit"
            className="mt-1 w-full"
            onClick={() => setName("")}
          >
            지도에서 직접 선택
          </Button>
        )}
```

`import { Button } from "../ui/Button";`을 추가한다.

주소를 다시 조회하지 않는다 — 좌표가 그대로라 답이 같다. 지도도 움직이지 않는다.
검색 직후라면 마커가 화면 중앙에 있으므로 전환 즉시 핀이 그 자리에서 시작한다.

- [ ] **Step 4: 타입·린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 둘 다 출력 없이 종료(코드 0)

- [ ] **Step 5: 브라우저로 검증한다**

개발 서버가 떠 있어야 한다. `/register/place?name=예빈당 성수본점&address=…&lat=37.5427538&lng=127.0562415`
로 연다(검색에서 골라 들어가도 같다).

| # | 절차 | 기대 |
| --- | --- | --- |
| 1 | 진입 | 마커가 보이고 중앙 핀이 없다 |
| 2 | 지도를 크게 드래그 | 상호명·주소 **그대로**, `/api/geocode` 요청 **0건** |
| 3 | 확대·축소 | 그대로. 커서 쪽으로 확대된다 |
| 4 | "지도에서 직접 선택" | 중앙 핀이 나타나고 상호명이 "장소를 선택해 주세요"로. 주소는 그대로 |
| 5 | 그 상태로 드래그 | 주소가 갱신된다 |
| 6 | 그 상태로 확대·축소 | 주소가 바뀌지 않는다(줌 중심 고정) |
| 7 | 검색 없이 `/register/place` | 처음부터 중앙 핀 |
| 8 | "이 위치로 등록하기" | 두 모드 모두 올바른 좌표를 넘긴다 |

- [ ] **Step 6: 회귀를 확인한다**

- 맛집 상세(`variant="static"`)의 지도와 마커가 그대로다
- 등록 흐름(`/register`)이 그대로 동작한다

- [ ] **Step 7: 커밋**

```bash
git add src/components/places/PlaceLocationPicker.tsx
git commit -m "feat: 고른 장소를 지도에 못 박고 직접 선택으로 전환"
```

---

## 완료 조건

- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run lint` 통과
- [ ] Task 2 Step 5의 8개 시나리오
- [ ] 상세·등록 회귀 확인
- [ ] Storybook에 `marker` 스토리가 뜬다
