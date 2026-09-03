import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 병 스캔: 브라우저에서 1280px 로 줄인 JPEG(base64) 를 서버 액션으로 보내요.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
