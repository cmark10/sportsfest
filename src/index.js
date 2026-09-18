export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 1. GET /api/games
      if (path === '/api/games' && request.method === 'GET') {
        const { results } = await env.DB.prepare(`
          SELECT g.id, g.name, g.icon, g.schedule, g.venue, COUNT(p.id) AS playerCount
          FROM games g
          LEFT JOIN players p ON g.id = p.game_id
          GROUP BY g.id, g.name, g.icon, g.schedule, g.venue
          ORDER BY g.id ASC
        `).all();

        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 2. GET /api/players (THIS WAS MISSING)
      if (path === '/api/players' && request.method === 'GET') {
        const gameId = url.searchParams.get('gameId');
        if (!gameId) {
          return new Response(JSON.stringify({ error: 'Missing gameId parameter' }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }

        const parsedGameId = parseInt(gameId, 10);

        const { results } = await env.DB.prepare(`
          SELECT name, department, position, created_at 
          FROM players 
          WHERE game_id = ? 
          ORDER BY created_at DESC
        `).bind(parsedGameId).all();

        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 3. POST /api/register
      if (path === '/api/register' && request.method === 'POST') {
        const { name, department, gameId, position } = await request.json();
        const parsedGameId = parseInt(gameId, 10);

        await env.DB.prepare(`
          INSERT INTO players (name, department, game_id, position)
          VALUES (?, ?, ?, ?)
        `).bind(name, department, parsedGameId, position || '').run();

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 4. Static Assets fallback
      return env.ASSETS.fetch(request);

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, 
        headers: corsHeaders 
      });
    }
  }
};
