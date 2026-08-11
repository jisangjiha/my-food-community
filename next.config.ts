import path from "node:path";
import type { NextConfig } from "next";

/**
 * Supabase Storage 호스트는 프로젝트마다 다르다. 여기에 박아 두면 프로젝트를
 * 옮길 때 `.env`와 이 파일이 따로 놀게 되므로, `SUPABASE_URL`에서 뽑아 쓴다.
 *
 * 값이 없으면 이 패턴만 빼고 진행한다. 앱 자체는 `src/lib/supabase/env.ts`에서
 * 이미 터지므로, 여기서 빌드를 멈춰 스토리북 같은 곁가지까지 막을 이유가 없다.
 */
function supabaseStorageHostname(): string | null {
  const url = process.env.SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const supabaseHostname = supabaseStorageHostname();

const nextConfig: NextConfig = {
  // 상위 폴더에 있는 package-lock.json 때문에 워크스페이스 루트가 잘못 잡히는 것을 방지
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    // next/image는 허용된 호스트만 최적화한다. 두 곳에서만 원격 이미지가 온다:
    // Supabase Storage의 공개 객체와 Google 계정 아바타.
    remotePatterns: [
      ...(supabaseHostname
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHostname,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/a/**",
      },
    ],
  },
};

export default nextConfig;
