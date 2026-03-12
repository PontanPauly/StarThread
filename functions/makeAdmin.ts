import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update user role to admin using service role
    const updated = await base44.asServiceRole.entities.User.update(user.id, { role: 'admin' });

    return Response.json({
      success: true,
      message: 'You are now an admin',
      user: updated,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});