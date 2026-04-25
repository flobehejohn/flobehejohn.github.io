export {};

declare global {
  interface Window {
    AppRuntimeUrl?: {
      version?: string;
      baseHref: () => string;
      asset: (path: string) => string;
      page: (path: string) => string;
      normalizeInternalHref: (href: string) => string;
      isInternalAppUrl: (url: string) => boolean;
      fromCurrentScriptAssetBase: () => string;
    };
    PlayerSingleton?: unknown;
    __APP_RUNTIME_URL_AUDIT__?: unknown;
    __PAGE_HUB_AUDIT__?: unknown;
    __CONTACT_AUDIT__?: Record<string, unknown>;
    __DOTNET_AUDIT__?: Record<string, unknown>;
    __NUAGE_AUDIT__?: Record<string, unknown>;
    __MEDIA_AUDIT__?: Record<string, unknown>;
    __RAWGITHACK_MOBILE_AUDIT__?: {
      active?: boolean;
      version?: string;
      reason?: string;
      snapshot?: () => any;
      copySnapshot?: () => Promise<void> | void;
      state?: Record<string, unknown>;
    };
  }
}
