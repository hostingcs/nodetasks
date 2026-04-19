const GITHUB_REPO = "hostingcs/nodetasks";
const APPLICATION_ID = "app.nodetasks.monitor";

type Release = {
  tag_name?: string;
  assets?: Array<{ name: string; browser_download_url: string }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  let release: Release | null = null;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        cache: "no-store",
        headers: { Accept: "application/vnd.github+json" },
      }
    );
    if (res.ok) release = (await res.json()) as Release;
  } catch {
    // fall through
  }

  const version = release?.tag_name?.replace(/^v/, "");
  const resourcesAsset = release?.assets?.find(
    (a) => a.name === "resources.neu"
  );

  const noStore = "no-store, no-cache, must-revalidate";

  if (!version || !resourcesAsset) {
    return Response.json(
      {
        applicationId: APPLICATION_ID,
        version: "0.0.0",
        resourcesURL: "",
        error: "No release available",
      },
      { status: 200, headers: { "Cache-Control": noStore } }
    );
  }

  return Response.json(
    {
      applicationId: APPLICATION_ID,
      version,
      resourcesURL: resourcesAsset.browser_download_url,
    },
    { headers: { "Cache-Control": noStore } }
  );
}
