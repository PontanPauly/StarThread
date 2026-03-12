import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // This function should be called by a scheduled task
    // Get all people with birthdays
    const people = await base44.asServiceRole.entities.Person.list();
    
    const today = new Date();
    const upcomingBirthdays = [];
    
    // Find birthdays in the next 7 days
    people.forEach(person => {
      if (!person.birth_date) return;
      
      const birthDate = new Date(person.birth_date);
      const thisYear = today.getFullYear();
      const nextBirthday = new Date(thisYear, birthDate.getMonth(), birthDate.getDate());
      
      if (nextBirthday < today) {
        nextBirthday.setFullYear(thisYear + 1);
      }
      
      const daysUntil = Math.ceil((nextBirthday - today) / (1000 * 60 * 60 * 24));
      
      if (daysUntil >= 0 && daysUntil <= 7) {
        upcomingBirthdays.push({
          person,
          daysUntil,
          date: nextBirthday,
        });
      }
    });
    
    if (upcomingBirthdays.length === 0) {
      return Response.json({ message: 'No upcoming birthdays' });
    }
    
    // Get all users to send notifications
    const users = await base44.asServiceRole.entities.User.list();
    
    // Send email to each family member
    for (const user of users) {
      let emailContent = `<h2>Upcoming Family Birthdays</h2>`;
      
      upcomingBirthdays.forEach(({ person, daysUntil, date }) => {
        const age = Math.floor((date - new Date(person.birth_date)) / (365.25 * 24 * 60 * 60 * 1000));
        const dayText = daysUntil === 0 ? 'today!' : 
                       daysUntil === 1 ? 'tomorrow' : 
                       `in ${daysUntil} days`;
        
        emailContent += `<p><strong>${person.name}</strong> turns ${age} ${dayText}</p>`;
      });
      
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: user.email,
        subject: `🎂 Upcoming Family Birthdays`,
        body: emailContent,
      });
    }
    
    return Response.json({ 
      message: 'Birthday reminders sent',
      count: upcomingBirthdays.length,
      recipients: users.length,
    });
  } catch (error) {
    console.error('Error sending birthday reminders:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});