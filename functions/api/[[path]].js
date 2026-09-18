export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // Normalize path (removes trailing slashes for exact matching)  
  let path = url.pathname.replace(/\/+$/, '');
  if (path === '') path = '/';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Diagnostic route to verify database connection
    if (path === '/api/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        dbBound: Boolean(env.DB),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/games
    if (path === '/api/games' && request.method === 'GET') {
      if (!env.DB) {
        return new Response(JSON.stringify({ error: 'D1 binding (env.DB) is missing in Cloudflare Dashboard' }), { status: 500, headers: corsHeaders });
      }

      const { results } = await env.DB.prepare(`
        SELECT 
          g.id, 
          g.name, 
          g.icon, 
          g.schedule, 
          g.venue, 
          COUNT(p.id) as playerCount
        FROM games g
        LEFT JOIN players p ON g.id = p.game_id
        GROUP BY g.id, g.name, g.icon, g.schedule, g.venue
        ORDER BY g.id ASC
      `).all();

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/players
    if (path === '/api/players' && request.method === 'GET') {
      if (!env.DB) {
        return new Response(JSON.stringify({ error: 'D1 binding (env.DB) is missing' }), { status: 500, headers: corsHeaders });
      }

      const gameId = url.searchParams.get('gameId');
      const { results } = await env.DB.prepare(`
        SELECT name, department, position 
        FROM players 
        WHERE game_id = ? 
        ORDER BY created_at DESC
      `).bind(gameId).all();

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /api/register
    if (path === '/api/register' && request.method === 'POST') {
      if (!env.DB) {
        return new Response(JSON.stringify({ error: 'D1 binding (env.DB) is missing' }), { status: 500, headers: corsHeaders });
      }

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

    return new Response(JSON.stringify({ error: `Route not found: ${path}` }), { status: 404, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}
