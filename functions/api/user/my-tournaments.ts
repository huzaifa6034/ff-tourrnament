
interface Env {
  DB: any;
}

export const onRequestGet: any = async (context: any) => {
  const { DB } = context.env;
  const url = new URL(context.request.url);
  const uid = url.searchParams.get("uid");

  if (!uid) return new Response("Missing UID", { status: 400 });

  try {
    const { results } = await DB.prepare("SELECT tournament_id FROM participants WHERE user_uid = ?")
      .bind(uid)
      .all();
    
    // Return just the IDs as an array
    const ids = results.map((r: any) => r.tournament_id);
    return new Response(JSON.stringify(ids), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500 });
  }
};
