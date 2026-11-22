/**
 * Stand-in for the private image bucket, for trying the ID review screen locally.
 * Answers every GET with a placeholder picture that names the key it was asked for, and
 * ignores the signature. NOT for anything real.
 *
 *   pnpm exec tsx tests/helpers/dev-images.ts
 *   # then run the app with:
 *   S3_ENDPOINT=http://127.0.0.1:9100 S3_PRIVATE_BUCKET=dev S3_ACCESS_KEY_ID=dev S3_SECRET_ACCESS_KEY=dev S3_REGION=auto
 */
import http from "node:http";

const PORT = Number(process.env.DEV_IMAGES_PORT ?? 9100);

http
  .createServer((req, res) => {
    const key = decodeURIComponent((req.url ?? "").split("?")[0]).replace(/^\/+/, "");
    const label = key.split("/").slice(-1)[0] || "image";
    const hue = [...key].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 360, 0);
    const esc = (s: string) => s.replace(/[<>&"]/g, "");
    res.writeHead(200, { "content-type": "image/svg+xml", "cache-control": "no-store" });
    res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <rect width="1200" height="800" fill="hsl(${hue} 40% 85%)"/>
  <rect x="60" y="60" width="1080" height="680" rx="24" fill="none" stroke="#333" stroke-width="6"/>
  <text x="600" y="380" font-size="72" text-anchor="middle" font-family="Arial">SAMPLE ${esc(label).toUpperCase()}</text>
  <text x="600" y="460" font-size="32" text-anchor="middle" font-family="Arial">${esc(key)}</text>
  <text x="130" y="700" font-size="28" font-family="Arial">Small print: zoom in to read this line</text>
</svg>`);
  })
  .listen(PORT, "127.0.0.1", () => console.log(`dev image server on port ${PORT}`));
