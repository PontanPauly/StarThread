import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Fetch all family data
    const [people, households, relationships, trips, moments, stories] = await Promise.all([
      base44.entities.Person.list(),
      base44.entities.Household.list(),
      base44.entities.Relationship.list(),
      base44.entities.Trip.list(),
      base44.entities.Moment.list(),
      base44.entities.FamilyStory.list(),
    ]);
    
    const exportData = {
      exported_at: new Date().toISOString(),
      exported_by: user.email,
      version: '1.0',
      data: {
        people,
        households,
        relationships,
        trips: trips.slice(0, 10), // Limit for size
        moments: moments.slice(0, 20),
        stories: stories.slice(0, 10),
      },
      statistics: {
        total_people: people.length,
        total_households: households.length,
        total_relationships: relationships.length,
        total_trips: trips.length,
        total_moments: moments.length,
        total_stories: stories.length,
      }
    };
    
    return Response.json(exportData, {
      headers: {
        'Content-Disposition': `attachment; filename="family-data-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});