/**
 * `src/lib/local-search/parse.ts` 확인 — `npm run check:parse`.
 *
 * 이 저장소에는 테스트 러너가 없다. 그런데 좌표 파싱은 조용히 틀리는 종류의
 * 코드다. 나누기를 잘못해도 지도는 아무 불평 없이 엉뚱한 곳을 가리킨다.
 * 러너를 들이는 대신, Node의 타입 스트리핑으로 바로 돌아가는 확인만 남긴다.
 *
 * 확장자가 `.mts`인 이유: `package.json`에 `"type"`이 없어 `.ts`는 CommonJS로
 * 해석되고 `import` 구문이 깨진다.
 */
import {
  stripHtml,
  toDegrees,
  parseLatLng,
  KOREA_BOUNDS,
} from "../src/lib/local-search/parse.ts";

const { minLat, maxLat, minLng, maxLng } = KOREA_BOUNDS;

const cases: [string, unknown, unknown][] = [
  ["stripHtml 태그", stripHtml("<b>오월</b>식당"), "오월식당"],
  ["stripHtml 엔티티", stripHtml("A&amp;B &#39;C&#39;"), "A&B 'C'"],
  ["stripHtml 앞뒤 공백", stripHtml("  <b>카페</b> 오월  "), "카페 오월"],
  ["10^7 정수 경도", toDegrees("1270276240", minLng, maxLng), 127.027624],
  ["10^7 정수 위도", toDegrees("375653770", minLat, maxLat), 37.565377],
  ["소수 경도", toDegrees("127.027624", minLng, maxLng), 127.027624],
  ["0은 버린다", toDegrees("0", minLng, maxLng), null],
  ["빈 문자열", toDegrees("", minLng, maxLng), null],
  ["undefined", toDegrees(undefined, minLng, maxLng), null],
  ["숫자가 아님", toDegrees("없음", minLng, maxLng), null],
  ["범위 밖(도쿄 경도)", toDegrees("139.7", minLng, maxLng), null],
  ["범위 밖(10^7 도쿄)", toDegrees("1397000000", minLng, maxLng), null],
  [
    "쌍 정상",
    JSON.stringify(parseLatLng("375653770", "1270276240")),
    JSON.stringify({ lat: 37.565377, lng: 127.027624 }),
  ],
  ["쌍 한쪽 결손", parseLatLng("375653770", ""), null],
  ["쌍 위경도 뒤바뀜", parseLatLng("1270276240", "375653770"), null],
  ["쌍 문자열 아님", parseLatLng(undefined, undefined), null],
];

let failed = 0;
for (const [label, actual, expected] of cases) {
  const ok = actual === expected;
  if (!ok) failed += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}  actual=${String(actual)} expected=${String(expected)}`,
  );
}

console.log(failed === 0 ? "\nAll passed" : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
