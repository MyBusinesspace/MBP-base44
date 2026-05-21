import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query, projectId } = await req.json();
    
    if (!query) {
      return Response.json({ error: 'SQL query is required' }, { status: 400 });
    }

    // Get BigQuery access token
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlebigquery');
    
    if (!accessToken) {
      return Response.json({ error: 'BigQuery not connected. Please authorize in settings.' }, { status: 401 });
    }

    // Execute BigQuery query
    const queryUrl = `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`;
    
    const response = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: query,
        useLegacySql: false,
        maxResults: 100
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return Response.json({ 
        error: 'BigQuery query failed', 
        details: data 
      }, { status: response.status });
    }

    return Response.json({
      success: true,
      rows: data.rows || [],
      schema: data.schema || {},
      totalRows: data.totalRows
    });
    
  } catch (error) {
    console.error('BigQuery query error:', error);
    return Response.json({ 
      error: 'Query execution failed', 
      message: error.message 
    }, { status: 500 });
  }
});