
interface Env {
  DB: any;
}

export const onRequestPost: any = async (context: any) => {
  const { DB } = context.env;
  const { uid, amount } = await context.request.json() as any;

  if (!uid || amount === undefined) {
    return new Response(JSON.stringify({ message: "Missing UID or amount" }), { status: 400 });
  }

  try {
    await DB.prepare("UPDATE users SET balance = ? WHERE uid = ?")
      .bind(amount, uid)
      .run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500 });
  }
};
