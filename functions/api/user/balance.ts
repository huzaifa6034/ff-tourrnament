
interface Env {
  // Using any to bypass missing D1Database type definition in current environment
  DB: any;
}

// Using any for PagesFunction to avoid type errors when Cloudflare types are not globally available
export const onRequestGet: any = async (context: any) => {
  const { DB } = context.env;
  const url = new URL(context.request.url);
  const uid = url.searchParams.get("uid");

  if (!uid) return new Response("Missing UID", { status: 400 });

  const result = await DB.prepare("SELECT balance FROM users WHERE uid = ?").bind(uid).first() as any;
  return new Response(JSON.stringify({ balance: result?.balance || 0 }), { status: 200 });
};