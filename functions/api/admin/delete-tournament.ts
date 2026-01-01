
interface Env {
  DB: any;
}

export const onRequestPost: any = async (context: any) => {
  const { DB } = context.env;
  const { id } = await context.request.json() as any;

  try {
    await DB.prepare("DELETE FROM tournaments WHERE id = ?").bind(id).run();
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500 });
  }
};
