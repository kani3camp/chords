import { metadata, socialTags } from './ogp';

// Minimal runtime surface; DOM types remain isolated from Workers' global types.
interface Element {
  setInnerContent(content: string): void;
  setAttribute(name: string, value: string): void;
  append(content: string, options: { html: boolean }): void;
  remove(): void;
}
declare const HTMLRewriter: {
  new(): {
    on(selector: string, handler: { element(element: Element): void }): InstanceType<typeof HTMLRewriter>;
    transform(response: Response): Response;
  };
};
type Env = { ASSETS: { fetch(request: Request): Promise<Response> } };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/' || !['GET','HEAD'].includes(request.method)) return env.ASSETS.fetch(request);
    // A static shell's validators/ranges cannot validate a query-specific HTML document.
    const assetRequest = new Request(request.url, { method:'GET', headers:request.headers });
    for (const h of ['if-none-match','if-modified-since','range','if-range']) assetRequest.headers.delete(h);
    const asset = await env.ASSETS.fetch(assetRequest);
    if (asset.status !== 200 || !asset.headers.get('content-type')?.includes('text/html')) return asset;
    const headers = new Headers(asset.headers);
    headers.set('Cache-Control','no-store');
    for (const h of ['etag','last-modified','content-length','content-range','accept-ranges']) headers.delete(h);
    const response = new Response(asset.body, {status:asset.status, headers});
    const data = metadata(request.url);
    const result = new HTMLRewriter()
      .on('title', { element: e => e.setInnerContent(data.title) })
      .on('meta[name="description"]', { element: e => e.setAttribute('content',data.description) })
      .on('meta[property^="og:"], meta[name^="twitter:"]', { element: e => e.remove() })
      .on('head', { element: e => e.append(socialTags(request.url,data), {html:true}) })
      .transform(response);
    return request.method === 'HEAD' ? new Response(null, {status:result.status,headers:result.headers}) : result;
  },
};
