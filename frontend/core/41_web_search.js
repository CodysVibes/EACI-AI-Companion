// ============================================================
// WEB SEARCH — Detects [[search:query]] in AI responses and fetches results
// ============================================================
async function handleSearchInResponse(rawReply, systemPrompt, history, who) {
  var searchMatch = rawReply.match(/\[\[search:([^\]]+)\]\]/);
  if (!searchMatch) return null;
  var query = searchMatch[1].trim();
  if (!query) return null;

  // Show the brief initial response (search tag stripped) — but do NOT push to history here
  // The caller manages history to avoid double-push
  var briefReply = cleanResponse(rawReply.replace(/\[\[search:[^\]]+\]\]/g, '').trim());
  if (briefReply && briefReply.length > 3) {
    addMessage(who, briefReply);
    // Brief reply goes to history so the follow-up has context
    state.conversationHistory.push({ role: 'assistant', content: '[' + (who === 'chad' ? 'Chad' : 'Caelum') + '] ' + briefReply });
  }

  // Show search status in UI
  var statusMsg = addSystemMessage('Searching for: ' + query + '...');

  var maxAttempts = 2;
  for (var attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      var headers = { 'Content-Type': 'application/json; charset=utf-8', 'apikey': SUPABASE_ANON_KEY };
      try { var authH = await getAuthHeaders(); Object.assign(headers, authH); } catch(e2) {}

      var resp = await fetch(CONFIG.searchEndpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ query: query })
      });

      // Check HTTP status before trying to parse
      if (!resp.ok) {
        var errText = '';
        try { errText = await resp.text(); } catch(e3) {}
        console.error('Search endpoint returned', resp.status, errText);
        logError('web_search_http', 'HTTP ' + resp.status, errText, CONFIG.searchEndpoint, { query: query, attempt: attempt });
        if (attempt < maxAttempts - 1) {
          await new Promise(function(r) { setTimeout(r, 1500); });
          continue; // retry once on server error
        }
        return who === 'chad'
          ? 'Search is down right now. Here is what I know.'
          : 'The search came back empty. Let me tell you what I know from here.';
      }

      var data;
      try { data = await resp.json(); } catch(parseErr) {
        console.error('Search response parse error:', parseErr);
        logError('web_search_parse', parseErr.message, '', CONFIG.searchEndpoint, { query: query });
        return 'The search returned something I could not read. Let me help with what I know.';
      }

      // Handle various response shapes from the edge function
      var results = data.results || data.data || data.items || [];
      if (!results.length) {
        // Edge function responded but found nothing
        var noResultMsg = who === 'chad'
          ? 'Nothing came back for that. Let me work with what I have.'
          : 'I did not find anything specific. Let me tell you what I know.';
        return noResultMsg;
      }

      // Build search context for DeepSeek
      var searchContext = 'LIVE WEB SEARCH RESULTS for "' + query + '":\n';
      results.slice(0, 5).forEach(function(r, i) {
        var title = r.title || r.name || '';
        var desc = r.description || r.snippet || r.summary || '';
        var url = r.url || r.link || '';
        searchContext += (i + 1) + '. ' + title + '\n   ' + desc + (url ? '\n   Source: ' + url : '') + '\n';
      });
      searchContext += '\nToday is ' + new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) + '. ';
      searchContext += 'Use these results to give a current, informed answer. Be yourself — warm and natural. ';
      searchContext += 'Cite sources conversationally if relevant. Do not include [[search:]] tags in your response.';

      var newHistory = history.slice(-10); // keep recent history lean
      if (briefReply && briefReply.length > 3) {
        newHistory.push({ role: 'assistant', content: briefReply });
      }
      newHistory.push({ role: 'user', content: '[Search results received. Please give your full response now.]' });

      var followUp = cleanResponse(await callDeepSeek(systemPrompt + '\n\n' + searchContext, newHistory, { skipCount: true }));
      return followUp || (who === 'chad' ? 'Got the results. Hard to summarize quickly.' : 'I found something but could not put it into words well. Can you ask me again?');

    } catch(e) {
      console.error('Web search error (attempt ' + attempt + '):', e);
      logError('web_search', e.message, e.stack || '', CONFIG.searchEndpoint, { query: query, attempt: attempt });
      if (attempt < maxAttempts - 1) {
        await new Promise(function(r) { setTimeout(r, 1500); });
        continue;
      }
      return who === 'chad'
        ? 'Search failed. Here is what I know without it.'
        : 'I could not reach the search right now. Let me tell you what I know.';
    }
  }
  return null;
}

