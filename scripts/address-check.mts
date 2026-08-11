/**
 * `src/lib/reverse-geocode/format.ts` 확인 — `npm run check:address`.
 *
 * 이 저장소에는 테스트 러너가 없다. 그런데 주소 조립은 조용히 틀리는 종류의
 * 코드다. 부번을 빠뜨려도 "서울특별시 성동구 성수동2가 315"는 그럴듯해 보인다.
 * 러너를 들이는 대신, Node의 타입 스트리핑으로 바로 돌아가는 확인만 남긴다.
 *
 * 확장자가 `.mts`인 이유: `package.json`에 `"type"`이 없어 `.ts`는 CommonJS로
 * 해석되고 `import` 구문이 깨진다. `scripts/parse-check.mts`와 같다.
 */
import {
  formatJibunAddress,
  type NaverGeocodeResult,
} from "../src/lib/reverse-geocode/format.ts";

const 성수동: NaverGeocodeResult = {
  region: {
    area1: { name: "서울특별시" },
    area2: { name: "성동구" },
    area3: { name: "성수동2가" },
    area4: { name: "" },
  },
  land: { type: "1", number1: "315", number2: "7" },
};

const cases: [string, unknown, unknown][] = [
  ["일반 지번", formatJibunAddress(성수동), "서울특별시 성동구 성수동2가 315-7"],
  [
    "부번 빈 문자열",
    formatJibunAddress({
      ...성수동,
      land: { type: "1", number1: "315", number2: "" },
    }),
    "서울특별시 성동구 성수동2가 315",
  ],
  [
    "부번 0",
    formatJibunAddress({
      ...성수동,
      land: { type: "1", number1: "315", number2: "0" },
    }),
    "서울특별시 성동구 성수동2가 315",
  ],
  [
    "임야는 산 접두사",
    formatJibunAddress({
      ...성수동,
      land: { type: "2", number1: "12", number2: "3" },
    }),
    "서울특별시 성동구 성수동2가 산 12-3",
  ],
  [
    "land 없음 → 행정구역까지",
    formatJibunAddress({ region: 성수동.region }),
    "서울특별시 성동구 성수동2가",
  ],
  [
    "본번 없음 → 행정구역까지",
    formatJibunAddress({
      ...성수동,
      land: { type: "1", number1: "", number2: "7" },
    }),
    "서울특별시 성동구 성수동2가",
  ],
  [
    "area4(리)까지 포함",
    formatJibunAddress({
      region: {
        area1: { name: "전라남도" },
        area2: { name: "광양시" },
        area3: { name: "광양읍" },
        area4: { name: "읍내리" },
      },
      land: { type: "1", number1: "33", number2: "" },
    }),
    "전라남도 광양시 광양읍 읍내리 33",
  ],
  [
    "공백만 있는 이름은 버린다",
    formatJibunAddress({ region: { area1: { name: "  " } } }),
    null,
  ],
  ["전부 빈 응답", formatJibunAddress({}), null],
  ["undefined", formatJibunAddress(undefined), null],
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
