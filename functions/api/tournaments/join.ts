
interface Env {
  DB: any;
}

export const onRequestPost: any = async (context: any) => {
  const { DB } = context.env;
  const { uid, tournamentId, entryFee } = await context.request.json() as any;

  if (!uid || !tournamentId || entryFee === undefined) {
    return new Response(JSON.stringify({ message: "Missing data" }), { status: 400 });
  }

  try {
    // 1. Check if user has enough balance
    const user = await DB.prepare("SELECT balance FROM users WHERE uid = ?").bind(uid).first();
    if (!user || user.balance < entryFee) {
      return new Response(JSON.stringify({ message: "Insufficient balance" }), { status: 400 });
    }

    // 2. Check if already joined
    const existing = await DB.prepare("SELECT * FROM participants WHERE tournament_id = ? AND user_uid = ?")
      .bind(tournamentId, uid)
      .first();
    
    if (existing) {
      return new Response(JSON.stringify({ message: "Already joined this tournament" }), { status: 400 });
    }

    // 3. Deduct balance and record participation (Transactional logic)
    const newBalance = user.balance - entryFee;
    const participantId = crypto.randomUUID();

    // In a real environment, we'd use DB.batch() for atomicity
    await DB.prepare("UPDATE users SET balance = ? WHERE uid = ?").bind(newBalance, uid).run();
    await DB.prepare("INSERT INTO participants (id, tournament_id, user_uid) VALUES (?, ?, ?)")
      .bind(participantId, tournamentId, uid)
      .run();

    return new Response(JSON.stringify({ success: true, newBalance }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500 });
  }
};
