
interface Env {
  // Using any to bypass missing D1Database type definition in current environment
  DB: any;
}

// Using any for PagesFunction to avoid type errors when Cloudflare types are not globally available
export const onRequestPost: any = async (context: any) => {
  const { DB } = context.env;
  const { username, email, password } = await context.request.json() as any;

  if (!username || !email || !password) {
    return new Response(JSON.stringify({ message: "All fields are required" }), { status: 400 });
  }

  const uid = crypto.randomUUID();

  try {
    // Check if email exists
    const existing = await DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
    if (existing) {
      return new Response(JSON.stringify({ message: "Email already exists" }), { status: 400 });
    }

    // Insert user (In real app, hash the password!)
    await DB.prepare(
      "INSERT INTO users (uid, username, email, password, balance) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(uid, username, email, password, 100.0)
    .run();

    const user = { uid, username, email, balance: 100.0 };
    return new Response(JSON.stringify({ user }), { status: 200 });

  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500 });
  }
};