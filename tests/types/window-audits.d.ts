export {};

type RuntimeUrlResolver = {
  version?: string;
  baseHref: () => string;
  asset: (path: string) => string;
  page: (path: string) => string;
  normalizeInternalHref: (href: string) => string;
  isInternalAppUrl: (url: string) => boolean;
  fromCurrentScriptAssetBase: () => string;
};

type MobileAuditSnapshot = {
  active: boolean;
  version: string;
  privacy: {
    readOnly: boolean;
    externalTransmissions: number;
    queryStringsRedacted?: boolean;
    clipboardOnlyOnUserGesture?: boolean;
    storage?: string;
  };
  counters?: Record<string, number>;
  records?: Record<string, unknown[]>;
};

declare global {
  interface Window {
    AppRuntimeUrl: RuntimeUrlResolver;
    PlayerSingleton?: unknown;
    __APP_RUNTIME_URL_AUDIT__?: unknown;
    __PAGE_HUB_AUDIT__?: unknown;
    __CONTACT_AUDIT__?: Record<string, unknown>;
    __DOTNET_AUDIT__: Record<string, unknown>;
    __NUAGE_AUDIT__: Record<string, unknown>;
    __MEDIA_AUDIT__: {
      cameraPermission?: 'granted' | 'denied' | 'unsupported' | string;
      getUserMediaCalls: number;
      fallbackVisible?: boolean;
      started?: boolean;
      [key: string]: unknown;
    };
    __RAWGITHACK_MOBILE_AUDIT__: {
      active: boolean;
      version?: string;
      reason?: string;
      snapshot: () => MobileAuditSnapshot;
      copySnapshot?: () => Promise<void> | void;
      state?: Record<string, unknown>;
    };
  }
}
