export const dynamic = "force-static";

export function GET() {
  return new Response("google-site-verification: google6d92fdf2787be2b4.html", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
