
interface Env {
  // Using any to bypass missing D1Database type definition in current environment
  DB: any;
}

// Using any for PagesFunction to avoid type errors when Cloudflare types are not globally available
export const onRequestPost: any = async (context: any) => {
  const { DB } = context.env;
  const { email, password } = await context.request.json() as any;

  try {
    const user = await DB.prepare("SELECT * FROM users WHERE email = ? AND password = ?")
      .bind(email, password)
      .first() as any;

    if (!user) {
      return new Response(JSON.stringify({ message: "Invalid email or password" }), { status: 401 });
    }

    // Don't send password back to frontend
    const { password: _, ...userSafe } = user;
    return new Response(JSON.stringify({ user: userSafe }), { status: 200 });

  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500 });
  }
};