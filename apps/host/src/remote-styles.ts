import {
  getRemoteStylesheets,
  RemoteFetchError,
  REMOTE_ERROR_DESCRIPTIONS,
} from "@module-federation/tanstack/runtime";

// Return only actionable metadata to the browser, never upstream bodies or URLs.
export async function inspectRemoteStyles(
  name: string,
  port: number,
  expose: string,
) {
  try {
    const stylesheets = await getRemoteStylesheets(
      `http://127.0.0.1:${port}/mf-manifest.json`,
      expose,
      { fetchTimeoutMs: 1500, maxAgeMs: 0 },
    );
    return { name, stylesheets, error: null };
  } catch (error) {
    return {
      name,
      stylesheets: [] as string[],
      error:
        error instanceof RemoteFetchError
          ? {
              code: error.code,
              description: REMOTE_ERROR_DESCRIPTIONS[error.code],
              status: error.status ?? null,
              retryable: error.retryable,
            }
          : {
              code: "MANIFEST-CONTRACT",
              description: "The manifest does not list the expected component.",
              status: null,
              retryable: false,
            },
    };
  }
}
