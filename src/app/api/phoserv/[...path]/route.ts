import { NextRequest } from "next/server";

const API_URL = process.env.PHOSERV_API_URL;
const API_TOKEN = process.env.PHOSERV_API_TOKEN;

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  if (!API_URL || !API_TOKEN) {
    return new Response(
      "phoserv web is not configured: set PHOSERV_API_URL and PHOSERV_API_TOKEN in web/.env.local",
      { status: 500 },
    );
  }

  const targetUrl = new URL(`${API_URL}/api/${path.join("/")}`);
  targetUrl.search = request.nextUrl.search;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("authorization", `Bearer ${API_TOKEN}`);

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  const upstream = await fetch(targetUrl, init);

  const responseHeaders = new Headers();
  const upstreamContentType = upstream.headers.get("content-type");
  if (upstreamContentType) responseHeaders.set("content-type", upstreamContentType);

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, ctx: RouteContext<"/api/phoserv/[...path]">) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/phoserv/[...path]">) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/phoserv/[...path]">) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
