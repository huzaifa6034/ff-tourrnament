
interface Env {
  DB: any;
}

export const onRequestPost: any = async (context: any) => {
  const { DB } = context.env;
  const data = await context.request.json() as any;
  const { user_uid, type, amount, details } = data;

  if (!user_uid || !type || !amount) {
    return new Response(JSON.stringify({ message: "Missing fields" }), { status: 400 });
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  try {
    await DB.prepare(
      "INSERT INTO transactions (id, user_uid, type, amount, status, details, createdAt) VALUES (?, ?, ?, ?, 'PENDING', ?, ?)"
    )
    .bind(id, user_uid, type, amount, details, createdAt)
    .run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500 });
  }
};
