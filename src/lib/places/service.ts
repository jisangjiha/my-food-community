import "server-only";

import { ForbiddenError, NotFoundError } from "@/lib/api/http";
import { createClient } from "@/lib/supabase/server";
import {
  PLACE_IMAGE_BUCKET,
  PROFILE_IMAGE_BUCKET,
  publicStorageUrl,
} from "@/lib/supabase/storage";
import {
  PLACE_IMAGE_MIME_TYPES,
  type CreatePlaceInput,
  type PlaceDto,
  type PlaceLocation,
  type UpdatePlaceInput,
} from "./dto";

/**
 * 맛집 데이터 접근 계층.
 *
 * Supabase를 아는 코드는 여기까지다. Route Handler와 서버 컴포넌트는 이 함수들만
 * 부르고, DTO만 받는다.
 *
 * 서버 컴포넌트에서 읽을 때는 자기 앱에 HTTP 요청을 보내지 말고 이 함수를 직접
 * 부른다. 네트워크 왕복 하나가 통째로 사라지고, 쿠키를 다시 실어 보낼 필요도 없다.
 */

/** join 결과 한 줄의 모양. Supabase 응답 파싱에만 쓰고 밖으로 내보내지 않는다. */
interface PlaceRow {
  id: string;
  title: string;
  content: string;
  address: string;
  created_at: string;
  user_id: string;
  name: string | null;
  lat: number | null;
  lng: number | null;
  place_image: { image_path: string }[] | null;
}

const PLACE_SELECT =
  "id, title, content, address, created_at, user_id, name, lat, lng, place_image(image_path)";

/**
 * 확장자는 MIME 타입에서 정한다. 클라이언트가 보낸 파일명은 쓰지 않는다.
 *
 * 키를 `PLACE_IMAGE_MIME_TYPES`로 묶어 뒀으므로, 허용 목록에 형식을 추가하면
 * 여기에 확장자를 적기 전까지 타입 검사가 통과하지 않는다.
 */
const IMAGE_EXTENSIONS: Record<(typeof PLACE_IMAGE_MIME_TYPES)[number], string> =
  {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };

export interface ListPlacesOptions {
  /** isMine 계산용. 비로그인이면 null. */
  viewerId?: string | null;
  /** 특정 사용자가 쓴 글만. 마이페이지가 쓴다. */
  authorId?: string;
}

export async function listPlaces({
  viewerId = null,
  authorId,
}: ListPlacesOptions = {}): Promise<PlaceDto[]> {
  const supabase = await createClient();

  let query = supabase
    .from("place")
    .select(PLACE_SELECT)
    // 지운 글은 목록에 없다. RLS도 같은 조건으로 막지만, 읽는 쪽 코드만 보고도
    // 무엇이 빠지는지 알 수 있어야 한다.
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (authorId) {
    query = query.eq("user_id", authorId);
  }

  const { data, error } = await query;

  if (error) {
    // 원본 에러는 로그에만. 호출자는 일반 예외를 받는다.
    console.error("[places] 목록 조회 실패", error);
    throw new Error("맛집 목록을 불러오지 못했습니다.");
  }

  const rows = (data ?? []) as PlaceRow[];
  const nicknames = await resolveNicknames(rows.map((row) => row.user_id));

  return rows.map((row) => toDto(row, viewerId, nicknames));
}

export async function getPlace(
  id: string,
  viewerId: string | null = null,
): Promise<PlaceDto> {
  const row = await readPlaceRow(id);
  const nicknames = await resolveNicknames([row.user_id]);

  return toDto(row, viewerId, nicknames);
}

/**
 * 맛집을 등록한다.
 *
 * 사진을 먼저 올리고 그 다음에 행을 쓴다. 반대로 하면 업로드가 실패했을 때
 * 사진 없는 글이 남는데, 사진은 필수라 그런 글은 목록에서 깨진 칸이 된다.
 * DB 쓰기가 실패하면 방금 올린 파일을 도로 지운다.
 */
export async function createPlace(
  input: CreatePlaceInput,
  authorId: string,
): Promise<PlaceDto> {
  const supabase = await createClient();
  const imagePaths = await uploadImages(authorId, input.images);

  const { data: place, error } = await supabase
    .from("place")
    .insert({
      title: input.title,
      content: input.content,
      name: input.location.name,
      address: input.location.address,
      lat: input.location.lat,
      lng: input.location.lng,
      // 클라이언트가 보낸 user_id를 쓰지 않는다. 남의 이름으로 글을 쓸 수 있게 된다.
      user_id: authorId,
    })
    .select("id")
    .single();

  if (error || !place) {
    console.error("[places] 등록 실패", error);
    await removeImages(imagePaths);
    throw new Error("맛집을 등록하지 못했습니다.");
  }

  const { error: imageError } = await supabase
    .from("place_image")
    .insert(imagePaths.map((path) => ({ place_id: place.id, image_path: path })));

  if (imageError) {
    // 사진이 필수인 이상 여기서 멈추면 반쪽짜리 글이 남는다. 되돌린다.
    console.error("[places] 이미지 연결 실패", imageError);
    await supabase.from("place").delete().eq("id", place.id);
    await removeImages(imagePaths);
    throw new Error("맛집을 등록하지 못했습니다.");
  }

  return getPlace(place.id, authorId);
}

/**
 * 맛집을 수정한다. 글쓴이만 할 수 있다.
 *
 * `input`은 "바뀐 것"이 아니라 "수정 후의 최종 상태"다. `keepImagePaths`에 없는
 * 기존 사진은 지운다.
 *
 * RLS도 남의 글은 막지만, 정책에 걸리면 update가 조용히 0행을 고치고 성공한다.
 * 사용자는 저장됐다고 믿는다. 그래서 소유자를 먼저 확인하고 403으로 답한다.
 *
 * PostgREST에는 여러 테이블을 묶는 트랜잭션이 없다. 중간에 실패하면 일부만
 * 반영된 채로 남을 수 있는데, 최종 상태를 통째로 받는 형태라 사용자가 다시
 * 저장하면 그대로 수렴한다.
 */
export async function updatePlace(
  id: string,
  input: UpdatePlaceInput,
  userId: string,
): Promise<PlaceDto> {
  const supabase = await createClient();
  const row = await readPlaceRow(id);

  if (row.user_id !== userId) {
    throw new ForbiddenError("내가 등록한 맛집만 수정할 수 있습니다.");
  }

  const currentPaths = imagePathsOf(row);
  // 남기겠다는 경로가 정말 이 글의 것인지 확인한다. 확인하지 않으면 남의 글
  // 사진 경로를 실어 보내 내 글에 붙일 수 있다.
  const keepPaths = input.keepImagePaths.filter((path) =>
    currentPaths.includes(path),
  );
  if (keepPaths.length !== input.keepImagePaths.length) {
    throw new NotFoundError("수정하려는 사진을 찾을 수 없습니다.");
  }

  const addedPaths = await uploadImages(userId, input.images);

  const { error } = await supabase
    .from("place")
    .update({
      title: input.title,
      content: input.content,
      name: input.location.name,
      address: input.location.address,
      lat: input.location.lat,
      lng: input.location.lng,
    })
    .eq("id", id);

  if (error) {
    console.error("[places] 수정 실패", error);
    await removeImages(addedPaths);
    throw new Error("맛집을 수정하지 못했습니다.");
  }

  await syncImageRows(id, {
    addedPaths,
    removedPaths: currentPaths.filter((path) => !keepPaths.includes(path)),
  });

  return getPlace(id, userId);
}

/**
 * 맛집을 지운다. 글쓴이만 할 수 있다.
 *
 * 행을 지우지 않고 `deleted_at`에 시각을 남긴다. 사진 파일도 그대로 둔다.
 * 실수로 지웠을 때 되살릴 수 있고, 지워진 글에 달렸던 것들(나중에 붙을 후기·
 * 저장)이 참조를 잃지 않는다.
 *
 * 이미 지운 글을 다시 지우면 `readPlaceRow`가 404를 던진다. 삭제된 글은 없는
 * 글과 같이 다루기 때문이고, 화면에서는 목록에서 사라진 카드를 다시 누를 수
 * 없으므로 마주칠 일이 없다.
 */
export async function softDeletePlace(
  id: string,
  userId: string,
): Promise<void> {
  const supabase = await createClient();
  const row = await readPlaceRow(id);

  if (row.user_id !== userId) {
    throw new ForbiddenError("내가 등록한 맛집만 삭제할 수 있습니다.");
  }

  const { error } = await supabase
    .from("place")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    // 그 사이 다른 요청이 이미 지웠다면 여기서 0행이 되고, 시각을 덮어쓰지 않는다.
    .is("deleted_at", null);

  if (error) {
    console.error("[places] 삭제 실패", error);
    throw new Error("맛집을 삭제하지 못했습니다.");
  }
}

/** 한 글의 이미지 행을 최종 상태에 맞춘다. */
async function syncImageRows(
  placeId: string,
  { addedPaths, removedPaths }: { addedPaths: string[]; removedPaths: string[] },
): Promise<void> {
  const supabase = await createClient();

  if (addedPaths.length > 0) {
    const { error } = await supabase
      .from("place_image")
      .insert(addedPaths.map((path) => ({ place_id: placeId, image_path: path })));

    if (error) {
      console.error("[places] 이미지 추가 실패", error);
      await removeImages(addedPaths);
      throw new Error("사진을 추가하지 못했습니다.");
    }
  }

  if (removedPaths.length > 0) {
    const { error } = await supabase
      .from("place_image")
      .delete()
      .eq("place_id", placeId)
      .in("image_path", removedPaths);

    if (error) {
      console.error("[places] 이미지 삭제 실패", error);
      throw new Error("사진을 삭제하지 못했습니다.");
    }

    // 행이 지워진 뒤에 파일을 지운다. 순서가 반대면 행은 남았는데 파일이 없는
    // 깨진 이미지가 화면에 뜬다.
    await removeImages(removedPaths);
  }
}

/**
 * 사진을 Storage에 올리고 경로 목록을 돌려준다.
 *
 * 경로는 `{user_id}/{uuid v4}.{확장자}`다. 첫 칸이 소유자인 이유는 버킷 정책이
 * `(storage.foldername(name))[1] = auth.uid()`로 판별하기 때문이다. 남의 폴더에
 * 쓰려는 요청은 여기까지 오더라도 Storage가 거절한다.
 *
 * 파일명을 uuid로 새로 짓는 이유: 원본 이름을 쓰면 공백·한글·`../`가 그대로
 * 경로가 되고, 같은 이름을 다시 올리면 이전 사진이 덮인다.
 *
 * 한 장이라도 실패하면 이미 올린 것을 지우고 던진다. 절반만 올라간 상태로
 * 글을 만들면 사용자가 고른 사진과 저장된 사진이 달라진다.
 */
async function uploadImages(userId: string, files: File[]): Promise<string[]> {
  if (files.length === 0) return [];

  const supabase = await createClient();
  const uploaded: string[] = [];

  for (const file of files) {
    if (!isAllowedMimeType(file.type)) {
      // 입력 계층에서 이미 걸렀어야 한다. 여기까지 왔다면 호출자 쪽 실수다.
      await removeImages(uploaded);
      throw new Error("지원하지 않는 이미지 형식입니다.");
    }

    const path = `${userId}/${crypto.randomUUID()}.${IMAGE_EXTENSIONS[file.type]}`;
    const { error } = await supabase.storage
      .from(PLACE_IMAGE_BUCKET)
      .upload(path, file, {
        contentType: file.type,
        // uuid라 부딪힐 일이 없다. upsert를 켜면 충돌이 조용히 덮어쓰기가 된다.
        upsert: false,
      });

    if (error) {
      console.error("[places] 이미지 업로드 실패", error);
      await removeImages(uploaded);
      throw new Error("사진을 올리지 못했습니다.");
    }

    uploaded.push(path);
  }

  return uploaded;
}

/**
 * 더 이상 참조되지 않는 파일을 지운다.
 *
 * 실패해도 던지지 않는다. 되돌리기 도중에 다시 던지면 사용자는 원래 무엇이
 * 잘못됐는지 못 보게 된다. 남은 파일은 로그로 남기고 넘어간다.
 */
async function removeImages(paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.storage.from(PLACE_IMAGE_BUCKET).remove(paths);

  if (error) {
    console.error("[places] 이미지 파일 삭제 실패", paths, error);
  }
}

function isAllowedMimeType(
  mimeType: string,
): mimeType is (typeof PLACE_IMAGE_MIME_TYPES)[number] {
  return (PLACE_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * 상세 한 줄. 없으면 404로 끊는다. 조회·수정·삭제가 같은 판단을 공유한다.
 *
 * 지운 글은 "없는 글"과 같이 다룬다. 404가 아니라 410을 주면 지웠다는 사실
 * 자체가 밖으로 새고, 삭제된 것을 알아내는 데 쓸 수 있다.
 */
async function readPlaceRow(id: string): Promise<PlaceRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("place")
    .select(PLACE_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    // uuid가 아닌 id로 조회하면 Postgres가 형식 오류를 낸다. 없는 글과 같은 뜻이다.
    if (error.code === "22P02") {
      throw new NotFoundError("맛집을 찾을 수 없습니다.");
    }
    console.error("[places] 상세 조회 실패", error);
    throw new Error("맛집 정보를 불러오지 못했습니다.");
  }
  if (!data) {
    throw new NotFoundError("맛집을 찾을 수 없습니다.");
  }

  return data as PlaceRow;
}

function imagePathsOf(row: PlaceRow): string[] {
  return (row.place_image ?? []).map(({ image_path }) => image_path);
}

function toDto(
  row: PlaceRow,
  viewerId: string | null,
  nicknames: Map<string, { nickname: string; imagePath: string | null }>,
): PlaceDto {
  const author = nicknames.get(row.user_id);

  return {
    id: row.id,
    title: row.title,
    content: row.content,
    location: toLocation(row),
    createdAt: row.created_at,
    images: imagePathsOf(row).map((path) => ({
      path,
      url: publicStorageUrl(PLACE_IMAGE_BUCKET, path),
    })),
    author: author
      ? {
          id: row.user_id,
          nickname: author.nickname,
          avatarUrl: author.imagePath
            ? publicStorageUrl(PROFILE_IMAGE_BUCKET, author.imagePath)
            : null,
        }
      : null,
    isMine: viewerId !== null && viewerId === row.user_id,
  };
}

/**
 * 행 → 지도 정보. 네 값이 다 있어야 인정한다.
 *
 * 좌표만으로 판정하지 않는 이유: 장소명 없이 좌표만 있는 행은 화면에서 "이름
 * 없는 어딘가"가 된다. 넷을 한 세트로 다루기로 한 이상 판정도 세트로 한다.
 *
 * `address`는 DB 기본값이 있어 항상 값이 있으므로 판정에 넣지 않는다.
 */
function toLocation(row: PlaceRow): PlaceLocation | null {
  const name = row.name?.trim() ?? "";
  if (name === "" || row.lat === null || row.lng === null) return null;

  return { name, address: row.address, lat: row.lat, lng: row.lng };
}

/** 작성자 프로필을 한 번에 읽는다. 행마다 조회하면 N+1이 된다. */
async function resolveNicknames(
  userIds: string[],
): Promise<Map<string, { nickname: string; imagePath: string | null }>> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile")
    .select("user_id, nickname, image_path")
    .in("user_id", unique);

  if (error) {
    console.error("[places] 프로필 조회 실패", error);
    return new Map();
  }

  return new Map(
    (data ?? []).map((profile) => [
      profile.user_id,
      { nickname: profile.nickname, imagePath: profile.image_path },
    ]),
  );
}
