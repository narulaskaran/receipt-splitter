interface ImportMetaEnv {
  readonly VITE_API_ORIGIN?: string;
  readonly VITE_PUBLIC_ORIGIN?: string;
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
