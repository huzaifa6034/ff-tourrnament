
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

    // Explicitly initializing all user stats as numbers (0 or 0.0)
    await DB.prepare(
      "INSERT INTO users (uid, username, email, password, balance, role, totalEarnings, matchesPlayed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(uid, username, email, password, 100.0, 'player', 0.0, 0)
    .run();

    const user = { 
      uid, 
      username, 
      email, 
      balance: 100.0, 
      role: 'player',
      totalEarnings: 0.0,
      matchesPlayed: 0
    };
    return new Response(JSON.stringify({ user }), { status: 200 });

  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500 });
  }
};
