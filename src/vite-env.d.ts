/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'http' (production) or 'mock' (development only). */
  readonly VITE_CAFE_TRANSPORT?: string;
  /** Base URL of the Café integration adapter/relay (public, no secrets). */
  readonly VITE_CAFE_API_BASE_URL?: string;
  readonly VITE_CAFE_API_TIMEOUT_MS?: string;
  /** Query parameter carrying the Café table token in QR URLs (default: "table"). */
  readonly VITE_TABLE_QR_PARAM?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.webp' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
