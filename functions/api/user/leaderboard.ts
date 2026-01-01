
interface Env {
  DB: any;
}

export const onRequestGet: any = async (context: any) => {
  const { DB } = context.env;
  try {
    const { results } = await DB.prepare(
      "SELECT username, totalEarnings, matchesPlayed FROM users ORDER BY totalEarnings DESC LIMIT 10"
    ).all();
    
    return new Response(JSON.stringify(results), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500 });
  }
};
