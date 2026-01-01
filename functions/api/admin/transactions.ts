
interface Env {
  DB: any;
}

export const onRequestGet: any = async (context: any) => {
  const { DB } = context.env;
  try {
    const { results } = await DB.prepare(`
      SELECT t.*, u.username 
      FROM transactions t 
      JOIN users u ON t.user_uid = u.uid 
      ORDER BY t.createdAt DESC
    `).all();
    return new Response(JSON.stringify(results), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500 });
  }
};

export const onRequestPost: any = async (context: any) => {
  const { DB } = context.env;
  const { transactionId, status, user_uid, amount } = await context.request.json() as any;

  try {
    // 1. Update Transaction status
    await DB.prepare("UPDATE transactions SET status = ? WHERE id = ?")
      .bind(status, transactionId)
      .run();

    // 2. If Approved and Type is Deposit, add balance
    if (status === 'APPROVED') {
       const tx = await DB.prepare("SELECT type FROM transactions WHERE id = ?").bind(transactionId).first();
       if (tx.type === 'DEPOSIT') {
          await DB.prepare("UPDATE users SET balance = balance + ? WHERE uid = ?")
            .bind(amount, user_uid)
            .run();
       } else if (tx.type === 'WITHDRAW') {
          // Balance already deducted or managed here
       }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500 });
  }
};
