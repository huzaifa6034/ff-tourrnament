
interface Env {
  DB: any;
}

export const onRequestGet: any = async (context: any) => {
  const { DB } = context.env;
  try {
    // Fetches all relevant user details for admin management
    const { results } = await DB.prepare("SELECT uid, username, email, balance, role, totalEarnings, matchesPlayed FROM users").all();
    return new Response(JSON.stringify(results), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500 });
  }
};
