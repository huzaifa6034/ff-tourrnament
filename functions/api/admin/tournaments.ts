
interface Env {
  DB: any;
}

export const onRequestGet: any = async (context: any) => {
  const { DB } = context.env;
  try {
    // We use a subquery to count participants for each tournament in real-time
    const { results } = await DB.prepare(`
      SELECT t.*, 
      (SELECT COUNT(*) FROM participants p WHERE p.tournament_id = t.id) as slotsFull 
      FROM tournaments t 
      ORDER BY t.id DESC
    `).all();
    
    return new Response(JSON.stringify(results), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500 });
  }
};

export const onRequestPost: any = async (context: any) => {
  const { DB } = context.env;
  const data = await context.request.json() as any;
  const id = crypto.randomUUID().substring(0, 8);

  try {
    await DB.prepare(
      "INSERT INTO tournaments (id, title, type, entryFee, prizePool, perKill, startTime, totalSlots, map) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(id, data.title, data.type, data.entryFee, data.prizePool, data.perKill, data.startTime, data.totalSlots || 48, data.map)
    .run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500 });
  }
};
