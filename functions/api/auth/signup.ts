
interface Env {
  DB: any;
}

export const onRequestPost: any = async (context: any) => {
  const { DB } = context.env;
  const { username, email, password } = await context.request.json() as any;

  if (!username || !email || !password) {
    return new Response(JSON.stringify({ message: "All fields are required" }), { status: 400 });
  }

  const uid = crypto.randomUUID();

  try {
    const existing = await DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
    if (existing) {
      return new Response(JSON.stringify({ message: "Email already exists" }), { status: 400 });
    }

    // Role is explicitly set to 'player' during signup
    await DB.prepare(
      "INSERT INTO users (uid, username, email, password, balance, role) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(uid, username, email, password, 100.0, 'player')
    .run();

    const user = { uid, username, email, balance: 100.0, role: 'player' };
    return new Response(JSON.stringify({ user }), { status: 200 });

  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500 });
  }
};
