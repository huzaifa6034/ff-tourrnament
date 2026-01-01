
interface Env {
  DB: any;
}

export const onRequestPost: any = async (context: any) => {
  const { DB } = context.env;
  const data = await context.request.json() as any;
  const { uid, role, totalEarnings, matchesPlayed } = data;

  if (!uid) {
    return new Response(JSON.stringify({ message: "Missing UID" }), { status: 400 });
  }

  try {
    let query = "UPDATE users SET ";
    const params = [];
    const fields = [];

    if (role !== undefined) { 
      fields.push("role = ?"); 
      params.push(role); 
    }
    if (totalEarnings !== undefined) { 
      fields.push("totalEarnings = ?"); 
      params.push(Number(totalEarnings)); 
    }
    if (matchesPlayed !== undefined) { 
      fields.push("matchesPlayed = ?"); 
      params.push(Number(matchesPlayed)); 
    }

    if (fields.length === 0) {
      return new Response(JSON.stringify({ message: "No fields to update" }), { status: 400 });
    }

    query += fields.join(", ") + " WHERE uid = ?";
    params.push(uid);

    await DB.prepare(query).bind(...params).run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500 });
  }
};
