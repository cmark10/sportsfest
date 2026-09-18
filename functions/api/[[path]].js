export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // GET /api/games
    if (path === '/api/games' && request.method === 'GET') {
      const { results } = await env.DB.prepare(`
        SELECT g.id, g.name, g.icon, g.schedule, g.venue, COUNT(p.id) as playerCount
        FROM games g
        LEFT JOIN players p ON g.id = p.game_id
        GROUP BY g.id
        ORDER BY g.id ASC
      `).all();

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/players?gameId=X
    if (path === '/api/players' && request.method === 'GET') {
      const gameId = url.searchParams.get('gameId');
      const { results } = await env.DB.prepare(`
        SELECT name, department, position FROM players WHERE game_id = ? ORDER BY created_at DESC
      `).bind(gameId).all();

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /api/register
    if (path === '/api/register' && request.method === 'POST') {
      const { name, department, gameId, position } = await request.json();

      if (!name || !department || !gameId) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
      }

      await env.DB.prepare(`
        INSERT INTO players (name, department, game_id, position) VALUES (?, ?, ?, ?)
      `).bind(name, department, gameId, position || '').run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}