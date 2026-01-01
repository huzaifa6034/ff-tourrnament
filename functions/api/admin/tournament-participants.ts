
interface Env {
  DB: any;
}

export const onRequestGet: any = async (context: any) => {
  const { DB } = context.env;
  const url = new URL(context.request.url);
  const tournamentId = url.searchParams.get("tournamentId");

  if (!tournamentId) return new Response("Missing Tournament ID", { status: 400 });

  try {
    const { results } = await DB.prepare(`
      SELECT u.username, u.email, u.uid 
      FROM participants p 
      JOIN users u ON p.user_uid = u.uid 
      WHERE p.tournament_id = ?
    `).bind(tournamentId).all();
    
    return new Response(JSON.stringify(results), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500 });
  }
};
