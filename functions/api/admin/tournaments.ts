
interface Env {
  DB: any;
}

export const onRequestGet: any = async (context: any) => {
  const { DB } = context.env;
  try {
    const { results } = await DB.prepare("SELECT * FROM tournaments ORDER BY id DESC").all();
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
    .bind(id, data.title, data.type, data.entryFee, data.prizePool, data.perKill, data.startTime, data.totalSlots, data.map)
    .run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500 });
  }
};
