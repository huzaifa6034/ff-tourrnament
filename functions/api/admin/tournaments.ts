
interface Env {
  DB: any;
}

export const onRequestGet: any = async (context: any) => {
  const { DB } = context.env;
  try {
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
  const id = data.id || crypto.randomUUID().substring(0, 8);

  try {
    // Check if updating or creating
    if (data.id) {
       await DB.prepare(
        "UPDATE tournaments SET title=?, type=?, entryFee=?, prizePool=?, perKill=?, startTime=?, totalSlots=?, map=?, roomId=?, roomPassword=? WHERE id=?"
      )
      .bind(data.title, data.type, data.entryFee, data.prizePool, data.perKill, data.startTime, data.totalSlots, data.map, data.roomId || '', data.roomPassword || '', data.id)
      .run();
    } else {
      await DB.prepare(
        "INSERT INTO tournaments (id, title, type, entryFee, prizePool, perKill, startTime, totalSlots, map, roomId, roomPassword) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(id, data.title, data.type, data.entryFee, data.prizePool, data.perKill, data.startTime, data.totalSlots || 48, data.map, data.roomId || '', data.roomPassword || '')
      .run();
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500 });
  }
};
