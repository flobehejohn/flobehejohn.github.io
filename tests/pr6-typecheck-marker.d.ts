type Page = {
  route: (
    matcher: (url: URL) => boolean,
    handler: (route: {
      fulfill(options: {
        status: number;
        contentType?: string;
        body?: string;
      }): Promise<void>;
    }) => Promise<void>
  ) => Promise<void>;
};
