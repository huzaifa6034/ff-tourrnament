
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
    // 1. Get Tournament details to check slots
    const tournament = await DB.prepare("SELECT totalSlots, (SELECT COUNT(*) FROM participants WHERE tournament_id = ?) as currentCount FROM tournaments WHERE id = ?")
      .bind(tournamentId, tournamentId)
      .first();

    if (!tournament) {
      return new Response(JSON.stringify({ message: "Tournament not found" }), { status: 404 });
    }

    if (tournament.currentCount >= tournament.totalSlots) {
      return new Response(JSON.stringify({ message: "Match is already full!" }), { status: 400 });
    }

    // 2. Check if user has enough balance
    const user = await DB.prepare("SELECT balance FROM users WHERE uid = ?").bind(uid).first();
    if (!user || user.balance < entryFee) {
      return new Response(JSON.stringify({ message: "Insufficient balance" }), { status: 400 });
    }

    // 3. Check if already joined
    const existing = await DB.prepare("SELECT * FROM participants WHERE tournament_id = ? AND user_uid = ?")
      .bind(tournamentId, uid)
      .first();
    
    if (existing) {
      return new Response(JSON.stringify({ message: "Already joined this tournament" }), { status: 400 });
    }

    // 4. Deduct balance and record participation
    const newBalance = user.balance - entryFee;
    const participantId = crypto.randomUUID();

    await DB.prepare("UPDATE users SET balance = ? WHERE uid = ?").bind(newBalance, uid).run();
    await DB.prepare("INSERT INTO participants (id, tournament_id, user_uid) VALUES (?, ?, ?)")
      .bind(participantId, tournamentId, uid)
      .run();

    return new Response(JSON.stringify({ success: true, newBalance }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500 });
  }
};
