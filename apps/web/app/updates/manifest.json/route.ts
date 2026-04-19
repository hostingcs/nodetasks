const GITHUB_REPO = "hostingcs/nodetasks";
const APPLICATION_ID = "app.nodetasks.monitor";

type Release = {
  tag_name?: string;
  assets?: Array<{ name: string; browser_download_url: string }>;
};

export const revalidate = 300;

export async function GET() {
  let release: Release | null = null;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        next: { revalidate: 300 },
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

  if (!version || !resourcesAsset) {
    return Response.json(
      {
        applicationId: APPLICATION_ID,
        version: "0.0.0",
        resourcesURL: "",
        error: "No release available",
      },
      { status: 200, headers: { "Cache-Control": "public, max-age=60" } }
    );
  }

  return Response.json(
    {
      applicationId: APPLICATION_ID,
      version,
      resourcesURL: resourcesAsset.browser_download_url,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    }
  );
}
