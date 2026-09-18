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
      // API Route: GET /api/games
      if (path === '/api/games' && request.method === 'GET') {
        const { results } = await env.DB.prepare(`
          SELECT g.id, g.name, g.icon, g.schedule, g.venue, COUNT(p.id) AS playerCount
          FROM games g LEFT JOIN players p ON g.id = p.game_id
          GROUP BY g.id, g.name, g.icon, g.schedule, g.venue
          ORDER BY g.id ASC
        `).all();
        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // API Route: POST /api/register
      if (path === '/api/register' && request.method === 'POST') {
        const { name, department, gameId, position } = await request.json();
        await env.DB.prepare(`
          INSERT INTO players (name, department, game_id, position) VALUES (?, ?, ?, ?)
        `).bind(name, department, gameId, position || '').run();
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Serve Frontend HTML UI for all other paths
      const html = `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sportsfest 2026</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-slate-900 text-white p-6">
        <h1 class="text-2xl font-bold text-amber-400">OEDC Sportsfest 2026</h1>
        <div id="app" class="mt-4">Loading sports from D1...</div>
        <script>
          fetch('/api/games')
            .then(res => res.json())
            .then(data => {
              document.getElementById('app').innerHTML = data.map(g => 
                '<div class="p-3 bg-slate-800 my-2 rounded">' + g.icon + ' ' + g.name + ' (' + g.playerCount + ' registered)</div>'
              ).join('');
            });
        </script>
      </body>
      </html>`;

      return new Response(html, { headers: { 'Content-Type': 'text/html' } });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }
};
