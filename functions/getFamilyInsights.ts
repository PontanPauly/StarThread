import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get family data
    const [people, relationships, trips, moments] = await Promise.all([
      base44.entities.Person.list(),
      base44.entities.Relationship.list(),
      base44.entities.Trip.list(),
      base44.entities.Moment.list(),
    ]);
    
    // Build context for LLM
    const familyContext = {
      people_count: people.length,
      adults: people.filter(p => p.role_type === 'adult').length,
      children: people.filter(p => p.role_type === 'child' || p.role_type === 'teen').length,
      ancestors: people.filter(p => p.is_deceased || p.role_type === 'ancestor').length,
      relationships_count: relationships.length,
      trips_count: trips.length,
      moments_count: moments.length,
    };
    
    const prompt = `You are a family historian analyzing family data. Here's the summary:
    
- Total family members: ${familyContext.people_count}
- Adults: ${familyContext.adults}
- Children/Teens: ${familyContext.children}
- Ancestors: ${familyContext.ancestors}
- Documented relationships: ${familyContext.relationships_count}
- Trips planned/completed: ${familyContext.trips_count}
- Captured moments: ${familyContext.moments_count}

Provide:
1. A warm, encouraging insight about their family universe
2. A suggestion for what they could add next to enrich their family history
3. An interesting observation about their family structure or activities

Keep it personal, warm, and under 200 words.`;
    
    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: false,
    });
    
    return Response.json({ insight: response });
  } catch (error) {
    console.error('Insights error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});