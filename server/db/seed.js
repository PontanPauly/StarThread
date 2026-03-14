import { pool } from './index.js';

export async function seedFamilyData({ force = false } = {}) {
  const client = await pool.connect();
  try {
    const { rows: existing } = await client.query('SELECT COUNT(*) as count FROM households');
    if (parseInt(existing[0].count) > 0 && !force) {
      console.log('Database already has data, skipping seed');
      return { seeded: false, message: 'Data already exists' };
    }

    console.log('Seeding initial family data...');
    await client.query('BEGIN');

    if (force) {
      console.log('Force seeding - clearing existing data...');
      const tablesToClean = [
        'messages', 'conversations', 'calendar_events', 'love_notes', 'moments',
        'family_stories', 'rituals', 'packing_items', 'shared_trip_items',
        'expenses', 'activities', 'rooms', 'meals', 'trip_participants', 'trips',
        'relationships', 'people', 'households', 'join_requests', 'family_settings'
      ];
      for (const table of tablesToClean) {
        try { await client.query(`DELETE FROM ${table}`); } catch {}
      }
    }

    const hIds = {};
    const pIds = {};

    async function createHousehold(key, name, description) {
      const { rows } = await client.query(
        `INSERT INTO households (name, description) VALUES ($1, $2) RETURNING id`,
        [name, description]
      );
      hIds[key] = rows[0].id;
    }

    async function createPerson(key, data) {
      const { rows } = await client.query(
        `INSERT INTO people (name, nickname, birth_date, role_type, household_id, household_status, allergies, dietary_preferences, is_deceased, about, medical_notes, star_profile)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [
          data.name,
          data.nickname || null,
          data.birth_date || null,
          data.role_type || 'adult',
          hIds[data.household] || null,
          data.household_status || 'primary',
          data.allergies || null,
          data.dietary_preferences || null,
          data.is_deceased || false,
          data.about || null,
          data.medical_notes || null,
          data.star_profile ? JSON.stringify(data.star_profile) : null,
        ]
      );
      pIds[key] = rows[0].id;
    }

    const RECIPROCAL_TYPES = {
      parent: 'child',
      child: 'parent',
      partner: 'partner',
      spouse: 'spouse',
      sibling: 'sibling',
      grandparent: 'grandchild',
      grandchild: 'grandparent',
    };

    async function createRelationship(personKey, relatedKey, type, subtype = 'biological') {
      await client.query(
        `INSERT INTO relationships (person_id, related_person_id, relationship_type, subtype, status_from_person, status_from_related) VALUES ($1, $2, $3, $4, 'confirmed', 'confirmed') ON CONFLICT DO NOTHING`,
        [pIds[personKey], pIds[relatedKey], type, subtype]
      );
      const reciprocal = RECIPROCAL_TYPES[type] || type;
      await client.query(
        `INSERT INTO relationships (person_id, related_person_id, relationship_type, subtype, status_from_person, status_from_related) VALUES ($1, $2, $3, $4, 'confirmed', 'confirmed') ON CONFLICT DO NOTHING`,
        [pIds[relatedKey], pIds[personKey], reciprocal, subtype]
      );
    }

    async function createCalendarEvent(title, date, eventType, personKeys, color) {
      const personIdArray = personKeys.map(k => pIds[k]).filter(Boolean);
      await client.query(
        `INSERT INTO calendar_events (title, date, event_type, person_ids, color) VALUES ($1, $2, $3, $4, $5)`,
        [title, date, eventType, personIdArray, color]
      );
    }

    await createHousehold('randy_nancy', 'Randy & Nancy Nash', 'The Nash family homestead - where it all began');
    await createHousehold('angela_brian', 'Angela & Brian Goldsberry', 'The Goldsberry household');
    await createHousehold('james_lisa', 'James & Lisa Nash', 'The James Nash family');
    await createHousehold('jonathan_nicole', 'Jonathan & Nicole Nash', 'Jonathan and Nicole\'s place');
    await createHousehold('andrew', 'Andrew Nash', 'Andrew\'s household');
    await createHousehold('matthew_megan', 'Matthew & Megan Nash', 'Matt and Megan\'s home');
    await createHousehold('paul', 'Paul Nash', 'Paul\'s place');
    await createHousehold('craig_annie', 'Craig & Annie Nash', 'The Craig Nash household');
    await createHousehold('karen_lynn', 'Karen & Lynn Humpert', 'The Humpert household');
    await createHousehold('clark_sandra', 'Clark & Sandra Nash', 'The Nash grandparents - Randy\'s parents');
    await createHousehold('herbert_miriam', 'Herbert & Miriam Pitzenberger', 'The Pitzenberger grandparents - Nancy\'s parents');
    await createHousehold('charlie', 'Charlie Pitzenberger', 'Charlie\'s place');
    await createHousehold('joyce', 'Joyce Pitzenberger', 'Joyce\'s place');
    await createHousehold('anne_roger', 'Anne & Roger Toon', 'The Toon household');
    await createHousehold('nathan_charity', 'Nathan & Charity Toon', 'Nathan and Charity\'s place');
    await createHousehold('philip_katy', 'Philip & Katy Toon', 'Philip and Katy\'s place');
    await createHousehold('ava_austin', 'Ava & Austin', 'Ava and Austin\'s place');
    await createHousehold('martin', 'Martin Folker', 'Martin\'s place');

    await createPerson('randy', {
      name: 'Randy Nash', nickname: 'Dad', birth_date: '1963-03-15',
      role_type: 'adult', household: 'randy_nancy',
      about: 'Patriarch of the Nash family. The oldest of three siblings.',
      medical_notes: 'Blood pressure medication - lisinopril 10mg daily',
      allergies: ['sulfa drugs'],
      star_profile: {
        shape: 'classic',
        colorPalette: 'solar',
        glowStyle: 'soft-halo',
        animation: 'steady',
        size: 'grand',
        brightness: 0.9,
        customColor: null,
        essence: 'Steady hand, warm heart, and the best dad jokes in the galaxy',
        interests: [
          { name: 'Fishing', icon: '🎣', color: '#3b82f6' },
          { name: 'Golf', icon: '⛳', color: '#22c55e' },
          { name: 'Grilling', icon: '🥩', color: '#ef4444' },
          { name: 'History', icon: '📚', color: '#a16207' },
          { name: 'College Football', icon: '🏈', color: '#f59e0b' },
        ],
        favorites: {
          food: 'A perfectly grilled steak',
          music: 'Country and classic rock',
          movie: 'Braveheart',
          place: 'The lake house',
          season: 'Fall',
          quote: 'Work hard, play hard',
        },
      },
    });
    await createPerson('nancy', {
      name: 'Nancy Nash', nickname: 'Mom', birth_date: '1964-07-22',
      role_type: 'adult', household: 'randy_nancy',
      about: 'Heart of the family. Keeps everyone connected.',
      dietary_preferences: ['low sodium'],
      allergies: ['penicillin'],
      star_profile: {
        shape: 'nebula',
        colorPalette: 'rose',
        glowStyle: 'soft-halo',
        animation: 'breathing',
        size: 'grand',
        brightness: 0.88,
        customColor: null,
        essence: 'The glue that holds this family together, with love and a good recipe',
        interests: [
          { name: 'Gardening', icon: '🌷', color: '#ec4899' },
          { name: 'Cooking', icon: '🍳', color: '#f59e0b' },
          { name: 'Reading', icon: '📖', color: '#8b5cf6' },
          { name: 'Quilting', icon: '🧵', color: '#f472b6' },
          { name: 'Family History', icon: '🌳', color: '#22c55e' },
        ],
        favorites: {
          food: 'Homemade chicken and dumplings',
          music: 'Hymns and soft country',
          movie: 'The Sound of Music',
          place: 'Her garden in the early morning',
          season: 'Spring',
          quote: 'Family is everything',
        },
      },
    });

    await createPerson('aunt_karen', {
      name: 'Karen Humpert', birth_date: '1966-11-08',
      role_type: 'adult', household: 'karen_lynn',
      is_deceased: true,
      about: 'Randy\'s younger sister. Deeply missed by the family.',
    });
    await createPerson('lynn', {
      name: 'Lynn Humpert', birth_date: '1964-09-14',
      role_type: 'adult', household: 'karen_lynn',
      about: 'Karen\'s husband.',
    });
    await createPerson('craig', {
      name: 'Craig Nash', birth_date: '1965-05-20',
      role_type: 'adult', household: 'craig_annie',
      about: 'Randy\'s brother. The middle Nash sibling.',
    });
    await createPerson('annie', {
      name: 'Annie Nash', birth_date: '1966-03-28',
      role_type: 'adult', household: 'craig_annie',
      about: 'Craig\'s wife.',
    });
    await createPerson('maddison', {
      name: 'Maddison Nash', birth_date: '1998-08-10',
      role_type: 'adult', household: 'craig_annie',
      about: 'Craig and Annie\'s daughter.',
    });

    await createPerson('clark', {
      name: 'Clark Lynn Nash', birth_date: '1933-06-12',
      role_type: 'ancestor', household: 'clark_sandra',
      is_deceased: true,
      about: 'Randy\'s father. Passed away in 1979 at 46.',
    });
    await createPerson('sandra', {
      name: 'Sandra Nash', birth_date: '1935-04-18',
      role_type: 'ancestor', household: 'clark_sandra',
      about: 'Randy\'s mother.',
    });
    await createPerson('herbert', {
      name: 'Herbert James Pitzenberger', birth_date: '1928-10-05',
      role_type: 'ancestor', household: 'herbert_miriam',
      is_deceased: true,
      about: 'Nancy\'s father. James Nash is named after him. Passed away in 1991.',
    });
    await createPerson('miriam', {
      name: 'Miriam Yvonne Pitzenberger', birth_date: '1930-12-20',
      role_type: 'ancestor', household: 'herbert_miriam',
      about: 'Nancy\'s mother. Maiden name Coburn.',
    });
    await createPerson('charlie', {
      name: 'Charlie Pitzenberger', birth_date: '1957-03-14',
      role_type: 'ancestor', household: 'charlie',
      is_deceased: true,
      about: 'Herbert and Miriam\'s oldest child. Never married. Passed away in 2019.',
    });
    await createPerson('joyce', {
      name: 'Joyce Pitzenberger', birth_date: '1958-07-22',
      role_type: 'ancestor', household: 'joyce',
      is_deceased: true,
      about: 'Herbert and Miriam\'s second child. Never married. Passed away in 2021.',
    });
    await createPerson('anne', {
      name: 'Anne Toon', birth_date: '1966-09-15',
      role_type: 'adult', household: 'anne_roger',
      about: 'Nancy\'s sister. Married to Roger. Maiden name Pitzenberger.',
    });
    await createPerson('roger', {
      name: 'Roger Toon', birth_date: '1964-11-03',
      role_type: 'adult', household: 'anne_roger',
      about: 'Anne\'s husband.',
    });
    await createPerson('nathan', {
      name: 'Nathan Toon', birth_date: '1992-05-18',
      role_type: 'adult', household: 'nathan_charity',
      about: 'Anne and Roger\'s oldest son. Married to Charity.',
    });
    await createPerson('charity', {
      name: 'Charity Toon', birth_date: '1993-02-11',
      role_type: 'adult', household: 'nathan_charity',
      about: 'Nathan\'s wife.',
    });
    await createPerson('henry_t', {
      name: 'Henry Toon', birth_date: '2018-04-20',
      role_type: 'child', household: 'nathan_charity',
      about: 'Nathan and Charity\'s oldest.',
    });
    await createPerson('teagan', {
      name: 'Teagan Toon', birth_date: '2020-01-15',
      role_type: 'child', household: 'nathan_charity',
      about: 'Nathan and Charity\'s daughter.',
    });
    await createPerson('emerson', {
      name: 'Emerson Toon', birth_date: '2022-06-08',
      role_type: 'child', household: 'nathan_charity',
      about: 'Nathan and Charity\'s youngest daughter.',
    });
    await createPerson('philip', {
      name: 'Philip Toon', birth_date: '1994-08-25',
      role_type: 'adult', household: 'philip_katy',
      about: 'Anne and Roger\'s younger son. Married to Katy.',
    });
    await createPerson('katy', {
      name: 'Katy Toon', birth_date: '1995-10-30',
      role_type: 'adult', household: 'philip_katy',
      about: 'Philip\'s wife.',
    });

    await createPerson('angela', {
      name: 'Angela Goldsberry', nickname: 'Ang', birth_date: '1984-01-10',
      role_type: 'adult', household: 'angela_brian',
      about: 'The oldest Nash sibling. Married to Brian.',
      dietary_preferences: ['gluten-free'],
      star_profile: {
        shape: 'crystal',
        colorPalette: 'violet',
        glowStyle: 'sparkle',
        animation: 'dancing',
        size: 'standard',
        brightness: 0.82,
        customColor: null,
        essence: 'First born, fiercely loyal, and always planning the next gathering',
        interests: [
          { name: 'Event Planning', icon: '🎉', color: '#a78bfa' },
          { name: 'Interior Design', icon: '🏠', color: '#f472b6' },
          { name: 'Yoga', icon: '🧘', color: '#34d399' },
          { name: 'Wine Tasting', icon: '🍷', color: '#991b1b' },
          { name: 'Travel', icon: '✈️', color: '#60a5fa' },
        ],
        favorites: {
          food: 'Sushi and a good charcuterie board',
          music: 'Pop and R&B',
          movie: 'The Notebook',
          place: 'Anywhere with a beach',
          season: 'Summer',
          quote: 'Life is too short to not celebrate everything',
        },
      },
    });
    await createPerson('brian', {
      name: 'Brian Goldsberry', birth_date: '1982-09-03',
      role_type: 'adult', household: 'angela_brian',
      about: 'Angela\'s husband.',
      allergies: ['shellfish'],
    });

    await createPerson('james', {
      name: 'James Nash', birth_date: '1985-06-18',
      role_type: 'adult', household: 'james_lisa',
      about: 'Second oldest Nash sibling. Married to Lisa.',
      star_profile: {
        shape: 'classic',
        colorPalette: 'celestial',
        glowStyle: 'pulsing-aura',
        animation: 'gentle-pulse',
        size: 'standard',
        brightness: 0.84,
        customColor: null,
        essence: 'Quiet strength, deep thinker, and the one everyone calls for advice',
        interests: [
          { name: 'Technology', icon: '💻', color: '#3b82f6' },
          { name: 'Running', icon: '🏃', color: '#22c55e' },
          { name: 'Sci-Fi', icon: '🚀', color: '#818cf8' },
          { name: 'Board Games', icon: '🎲', color: '#f59e0b' },
          { name: 'Home Brewing', icon: '🍺', color: '#b45309' },
        ],
        favorites: {
          food: 'Pizza night with the kids',
          music: 'Alternative and electronic',
          movie: 'Interstellar',
          place: 'His home office at midnight',
          season: 'Winter',
          quote: 'Stay curious',
        },
      },
    });
    await createPerson('lisa', {
      name: 'Lisa Nash', birth_date: '1987-02-14',
      role_type: 'adult', household: 'james_lisa',
      about: 'James\'s wife.',
      allergies: ['tree nuts'],
      dietary_preferences: ['vegetarian'],
    });

    await createPerson('jonathan', {
      name: 'Jonathan Nash', nickname: 'Jon', birth_date: '1986-04-25',
      role_type: 'adult', household: 'jonathan_nicole',
      about: 'Third Nash sibling. Married to Nicole.',
      star_profile: {
        shape: 'nova',
        colorPalette: 'solar',
        glowStyle: 'pulsing-aura',
        animation: 'breathing',
        size: 'standard',
        brightness: 0.85,
        customColor: null,
        essence: 'Always chasing the next trail and the next good story',
        interests: [
          { name: 'Hiking', icon: '🥾', color: '#4ade80' },
          { name: 'Wilderness', icon: '🌲', color: '#22c55e' },
          { name: 'Photography', icon: '📸', color: '#60a5fa' },
          { name: 'Camping', icon: '⛺', color: '#f59e0b' },
          { name: 'Storytelling', icon: '📖', color: '#a78bfa' },
        ],
        favorites: {
          food: 'Trail mix and campfire burgers',
          music: 'Indie folk and acoustic',
          movie: 'Into the Wild',
          place: 'Rocky Mountain National Park',
          season: 'Fall',
          quote: 'Not all who wander are lost',
        },
      },
    });
    await createPerson('nicole', {
      name: 'Nicole Nash', birth_date: '1986-08-12',
      role_type: 'adult', household: 'jonathan_nicole',
      about: 'Jonathan\'s wife.',
      medical_notes: 'Seasonal allergies - cetirizine as needed',
      allergies: ['pollen', 'dust mites'],
      star_profile: {
        shape: 'nebula',
        colorPalette: 'teal',
        glowStyle: 'soft-halo',
        animation: 'breathing',
        size: 'standard',
        brightness: 0.83,
        customColor: null,
        essence: 'Creative soul with a calm presence and a contagious laugh',
        interests: [
          { name: 'Painting', icon: '🎨', color: '#2dd4bf' },
          { name: 'Podcasts', icon: '🎧', color: '#818cf8' },
          { name: 'Baking', icon: '🧁', color: '#f472b6' },
          { name: 'Hiking', icon: '🥾', color: '#4ade80' },
          { name: 'Journaling', icon: '✍️', color: '#f59e0b' },
        ],
        favorites: {
          food: 'Fresh sourdough bread',
          music: 'Acoustic and indie pop',
          movie: 'Amélie',
          place: 'A quiet coffee shop',
          season: 'Autumn',
          quote: 'Create the life you want to live',
        },
      },
    });

    await createPerson('andrew', {
      name: 'Andrew Nash', nickname: 'Drew', birth_date: '1987-10-30',
      role_type: 'adult', household: 'andrew',
      about: 'Fourth Nash sibling. Single dad of two.',
      allergies: ['dairy'],
      dietary_preferences: ['dairy-free'],
      star_profile: {
        shape: 'classic',
        colorPalette: 'ember',
        glowStyle: 'sharp-rays',
        animation: 'gentle-pulse',
        size: 'standard',
        brightness: 0.8,
        customColor: null,
        essence: 'Builder, uncle, fixer, and late-night thinker',
        interests: [
          { name: 'Cars', icon: '🚗', color: '#f87171' },
          { name: 'Road Trips', icon: '🛣️', color: '#fb923c' },
          { name: 'BBQ', icon: '🔥', color: '#ef4444' },
          { name: 'Woodworking', icon: '🪵', color: '#a16207' },
          { name: 'Classic Rock', icon: '🎸', color: '#7c3aed' },
        ],
        favorites: {
          food: 'Slow-smoked brisket',
          music: 'Classic rock and 90s alternative',
          movie: 'The Shawshank Redemption',
          place: 'The open highway',
          season: 'Summer',
          quote: 'Measure twice, cut once',
        },
      },
    });

    await createPerson('matthew', {
      name: 'Matthew Nash', nickname: 'Matt', birth_date: '1995-02-07',
      role_type: 'adult', household: 'matthew_megan',
      about: 'Paul\'s twin brother. Married to Megan.',
      star_profile: {
        shape: 'crystal',
        colorPalette: 'indigo',
        glowStyle: 'sharp-rays',
        animation: 'twinkle',
        size: 'standard',
        brightness: 0.8,
        customColor: null,
        essence: 'The competitive twin who never stops moving',
        interests: [
          { name: 'Basketball', icon: '🏀', color: '#f97316' },
          { name: 'Gaming', icon: '🎮', color: '#818cf8' },
          { name: 'Fitness', icon: '💪', color: '#ef4444' },
          { name: 'Cooking', icon: '👨‍🍳', color: '#f59e0b' },
        ],
        favorites: {
          food: 'Tacos - any kind, any time',
          music: 'Hip hop and EDM',
          movie: 'The Dark Knight',
          place: 'The gym',
          season: 'Summer',
        },
      },
    });
    await createPerson('megan', {
      name: 'Megan Nash', birth_date: '1994-06-19',
      role_type: 'adult', household: 'matthew_megan',
      about: 'Matthew\'s wife.',
      dietary_preferences: ['pescatarian'],
    });

    await createPerson('paul', {
      name: 'Paul Nash', birth_date: '1995-02-07',
      role_type: 'adult', household: 'paul',
      about: 'The youngest Nash sibling. Matthew\'s twin.',
      star_profile: {
        shape: 'nova',
        colorPalette: 'sunset',
        glowStyle: 'pulsing-aura',
        animation: 'dancing',
        size: 'standard',
        brightness: 0.78,
        customColor: null,
        essence: 'The free spirit twin - spontaneous, funny, always up for anything',
        interests: [
          { name: 'Music', icon: '🎵', color: '#a78bfa' },
          { name: 'Skateboarding', icon: '🛹', color: '#f97316' },
          { name: 'Art', icon: '🎨', color: '#ec4899' },
          { name: 'Travel', icon: '🌍', color: '#3b82f6' },
        ],
        favorites: {
          food: 'Ramen from a hole-in-the-wall place',
          music: 'Indie rock and jazz',
          movie: 'Eternal Sunshine of the Spotless Mind',
          place: 'Wherever the road takes him',
          season: 'Spring',
        },
      },
    });

    await createPerson('martin', {
      name: 'Martin Folker', birth_date: '2003-03-22',
      role_type: 'adult', household: 'martin',
      about: 'Angela\'s oldest.',
      allergies: ['peanuts'],
    });
    await createPerson('ava', {
      name: 'Ava Goldsberry', birth_date: '2004-08-15',
      role_type: 'adult', household: 'ava_austin',
      about: 'Angela\'s daughter. Lives with her boyfriend Austin.',
    });
    await createPerson('austin', {
      name: 'Austin', birth_date: '2003-05-10',
      role_type: 'adult', household: 'ava_austin',
      about: 'Ava\'s boyfriend.',
    });
    await createPerson('nash_g', {
      name: 'Nash Goldsberry', birth_date: '2007-12-01',
      role_type: 'teen', household: 'angela_brian',
      about: 'The youngest Goldsberry.',
    });

    await createPerson('mason', {
      name: 'Mason Nash', birth_date: '2014-04-11',
      role_type: 'child', household: 'james_lisa',
      allergies: ['bee stings'],
      medical_notes: 'Carries EpiPen for bee sting allergy',
    });
    await createPerson('harvey', {
      name: 'Harvey Nash', birth_date: '2015-09-28',
      role_type: 'child', household: 'james_lisa',
    });
    await createPerson('vivian', {
      name: 'Vivian Nash', birth_date: '2018-05-16',
      role_type: 'child', household: 'james_lisa',
      dietary_preferences: ['no spicy food'],
    });
    await createPerson('ethan', {
      name: 'Ethan Nash', birth_date: '2020-01-09',
      role_type: 'child', household: 'james_lisa',
      allergies: ['eggs'],
    });

    await createPerson('emmett', {
      name: 'Emmett Nash', birth_date: '2012-07-14',
      role_type: 'teen', household: 'andrew',
      about: 'Andrew\'s oldest.',
    });
    await createPerson('ella', {
      name: 'Ella Nash', birth_date: '2014-03-05',
      role_type: 'child', household: 'andrew',
      about: 'Andrew\'s daughter.',
      dietary_preferences: ['vegetarian'],
    });

    await createRelationship('clark', 'sandra', 'partner');
    await createRelationship('clark', 'randy', 'parent');
    await createRelationship('sandra', 'randy', 'parent');
    await createRelationship('clark', 'craig', 'parent');
    await createRelationship('sandra', 'craig', 'parent');
    await createRelationship('clark', 'aunt_karen', 'parent');
    await createRelationship('sandra', 'aunt_karen', 'parent');

    await createRelationship('herbert', 'miriam', 'partner');
    await createRelationship('herbert', 'charlie', 'parent');
    await createRelationship('miriam', 'charlie', 'parent');
    await createRelationship('herbert', 'joyce', 'parent');
    await createRelationship('miriam', 'joyce', 'parent');
    await createRelationship('herbert', 'nancy', 'parent');
    await createRelationship('miriam', 'nancy', 'parent');
    await createRelationship('herbert', 'anne', 'parent');
    await createRelationship('miriam', 'anne', 'parent');
    const pitzChildren = ['charlie', 'joyce', 'nancy', 'anne'];
    for (let i = 0; i < pitzChildren.length; i++) {
      for (let j = i + 1; j < pitzChildren.length; j++) {
        await createRelationship(pitzChildren[i], pitzChildren[j], 'sibling');
      }
    }

    await createRelationship('anne', 'roger', 'partner');
    await createRelationship('anne', 'nathan', 'parent');
    await createRelationship('roger', 'nathan', 'parent');
    await createRelationship('anne', 'philip', 'parent');
    await createRelationship('roger', 'philip', 'parent');
    await createRelationship('nathan', 'philip', 'sibling');
    await createRelationship('nathan', 'charity', 'partner');
    await createRelationship('nathan', 'henry_t', 'parent');
    await createRelationship('charity', 'henry_t', 'parent');
    await createRelationship('nathan', 'teagan', 'parent');
    await createRelationship('charity', 'teagan', 'parent');
    await createRelationship('nathan', 'emerson', 'parent');
    await createRelationship('charity', 'emerson', 'parent');
    await createRelationship('henry_t', 'teagan', 'sibling');
    await createRelationship('henry_t', 'emerson', 'sibling');
    await createRelationship('teagan', 'emerson', 'sibling');
    await createRelationship('philip', 'katy', 'partner');

    await createRelationship('randy', 'nancy', 'partner');

    await createRelationship('randy', 'aunt_karen', 'sibling');
    await createRelationship('randy', 'craig', 'sibling');
    await createRelationship('aunt_karen', 'craig', 'sibling');
    await createRelationship('craig', 'annie', 'partner');
    await createRelationship('craig', 'maddison', 'parent');
    await createRelationship('annie', 'maddison', 'parent');
    await createRelationship('aunt_karen', 'lynn', 'partner');

    const nashChildren = ['angela', 'james', 'jonathan', 'andrew', 'matthew', 'paul'];
    for (const child of nashChildren) {
      await createRelationship('randy', child, 'parent');
      await createRelationship('nancy', child, 'parent');
    }
    for (let i = 0; i < nashChildren.length; i++) {
      for (let j = i + 1; j < nashChildren.length; j++) {
        await createRelationship(nashChildren[i], nashChildren[j], 'sibling');
      }
    }

    await createRelationship('angela', 'brian', 'partner');
    await createRelationship('angela', 'martin', 'parent');
    await createRelationship('brian', 'martin', 'parent', 'step');
    for (const child of ['ava', 'nash_g']) {
      await createRelationship('angela', child, 'parent');
      await createRelationship('brian', child, 'parent', 'step');
    }
    await createRelationship('martin', 'ava', 'sibling');
    await createRelationship('martin', 'nash_g', 'sibling');
    await createRelationship('ava', 'nash_g', 'sibling');

    await createRelationship('james', 'lisa', 'partner');
    const jamesKids = ['mason', 'harvey', 'vivian', 'ethan'];
    for (const child of jamesKids) {
      await createRelationship('james', child, 'parent');
      await createRelationship('lisa', child, 'parent');
    }
    for (let i = 0; i < jamesKids.length; i++) {
      for (let j = i + 1; j < jamesKids.length; j++) {
        await createRelationship(jamesKids[i], jamesKids[j], 'sibling');
      }
    }

    await createRelationship('jonathan', 'nicole', 'partner');

    for (const child of ['emmett', 'ella']) {
      await createRelationship('andrew', child, 'parent');
    }
    await createRelationship('emmett', 'ella', 'sibling');

    await createRelationship('matthew', 'megan', 'partner');

    await createRelationship('ava', 'austin', 'partner');

    await createCalendarEvent('Randy\'s Birthday', '2026-03-15', 'birthday', ['randy'], '#f59e0b');
    await createCalendarEvent('Nancy\'s Birthday', '2026-07-22', 'birthday', ['nancy'], '#ec4899');
    await createCalendarEvent('Angela\'s Birthday', '2026-01-10', 'birthday', ['angela'], '#ec4899');
    await createCalendarEvent('James\'s Birthday', '2026-06-18', 'birthday', ['james'], '#3b82f6');
    await createCalendarEvent('Jonathan\'s Birthday', '2026-04-25', 'birthday', ['jonathan'], '#3b82f6');
    await createCalendarEvent('Andrew\'s Birthday', '2026-10-30', 'birthday', ['andrew'], '#3b82f6');
    await createCalendarEvent('Matthew & Paul\'s Birthday', '2026-02-07', 'birthday', ['matthew', 'paul'], '#8b5cf6');
    await createCalendarEvent('Megan\'s Birthday', '2026-06-19', 'birthday', ['megan'], '#ec4899');
    await createCalendarEvent('Nash Family Reunion', '2026-07-04', 'gathering', [], '#10b981');
    await createCalendarEvent('Thanksgiving Dinner', '2026-11-26', 'gathering', [], '#f59e0b');
    await createCalendarEvent('Christmas Gathering', '2026-12-25', 'gathering', [], '#ef4444');

    await client.query(
      `INSERT INTO love_notes (content, from_person_id, to_person_id, created_date) VALUES
        ($1, $2, $3, '2025-02-14'),
        ($4, $5, $6, '2025-01-20'),
        ($7, $8, $9, '2024-12-25'),
        ($10, $11, $12, '2025-03-15'),
        ($13, $14, $15, '2025-01-01'),
        ($16, $17, $18, '2024-11-28'),
        ($19, $20, $21, '2025-02-07'),
        ($22, $23, $24, '2024-10-30'),
        ($25, $26, $27, '2025-04-01'),
        ($28, $29, $30, '2024-09-15')`,
      [
        'Happy Valentine\'s Day to the love of my life. 40+ years and I\'d choose you every single time.', pIds['randy'], pIds['nancy'],
        'Mom, thank you for always being our rock. This family doesn\'t work without you. Love you more than words can say.', pIds['angela'], pIds['nancy'],
        'Merry Christmas, Dad. You taught me what it means to work hard and love harder. I hope I make you proud.', pIds['james'], pIds['randy'],
        'Happy Birthday, Dad! You\'re the best fishing buddy, grill master, and advice-giver a kid could ask for.', pIds['jonathan'], pIds['randy'],
        'New year, same amazing mom. Here\'s to another year of your chicken and dumplings and your endless love.', pIds['andrew'], pIds['nancy'],
        'Mom & Dad, Thanksgiving wouldn\'t be Thanksgiving without you two. Grateful for this family every single day.', pIds['matthew'], pIds['nancy'],
        'Happy birthday to my other half. Being your twin is the best thing that ever happened to me.', pIds['paul'], pIds['matthew'],
        'Drew, you\'re the strongest person I know. Those kids are lucky to have you. We all are.', pIds['nancy'], pIds['andrew'],
        'To my beautiful wife. Your garden, your cooking, your heart. Everything you touch blooms.', pIds['randy'], pIds['nancy'],
        'Angela, watching you plan every family gathering reminds me where you got it from. You\'re just like your mother. ❤️', pIds['randy'], pIds['angela'],
      ]
    );

    await client.query(
      `INSERT INTO family_stories (title, content, author_person_id, related_person_ids, era, created_date) VALUES
        ($1, $2, $3, $4, $5, '2025-01-15'),
        ($6, $7, $8, $9, $10, '2024-11-20'),
        ($11, $12, $13, $14, $15, '2025-02-28'),
        ($16, $17, $18, $19, $20, '2024-08-10'),
        ($21, $22, $23, $24, $25, '2025-03-05')`,
      [
        'How Mom and Dad Met',
        'It was the summer of 1982 at a church picnic in Dayton. Dad says he noticed Mom across the field and told his buddy Craig he was going to marry that girl. Mom says he tripped over a cooler trying to introduce himself. Either way, by the end of the afternoon they\'d exchanged numbers, and the rest, as Dad loves to say, is history. They were married in June of 1983, and forty years later, he still looks at her the same way.',
        pIds['angela'], [pIds['randy'], pIds['nancy']], '1980s',

        'The Great Road Trip of \'98',
        'In the summer of 1998, Dad packed all six of us into the old Suburban and drove from Ohio to Yellowstone. No GPS, no iPads, just a paper atlas and Mom\'s snack bag. Jonathan got carsick in Wyoming. Matthew and Paul fought over the middle seat for 2,000 miles. Andrew kept a journal the whole trip that we still have somewhere. Angela was in charge of the radio. James navigated. Mom says it was chaos. Dad says it was perfect. We all agree it was both.',
        pIds['nancy'], [pIds['randy'], pIds['nancy'], pIds['angela'], pIds['james'], pIds['jonathan'], pIds['andrew'], pIds['matthew'], pIds['paul']], '1990s',

        'Grandpa Clark\'s Fishing Stories',
        'Grandpa Clark passed away young, in 1979, when Dad was just 16. But the stories he left behind are legendary. He\'d take the boys to Indian Lake before dawn and tell them tales about catfish the size of canoes. Craig swears one of them was true. Dad keeps Grandpa\'s old tackle box in the garage and won\'t let anyone touch it. Every time we go fishing as a family, Dad tells at least one of Grandpa\'s stories, and for a moment, it feels like he\'s still with us.',
        pIds['randy'], [pIds['clark'], pIds['randy'], pIds['craig']], '1970s',

        'The Night the Twins Arrived',
        'February 7, 1995, the night Matthew and Paul decided to show up three weeks early. Dad was at a work dinner. Mom was home with Angela, James, Jonathan, and Andrew, who was seven and reportedly very unhelpful. Angela, barely eleven, called 911 while James tried to keep the younger kids calm. By the time Dad got to the hospital, both boys were already here, screaming their lungs out. Mom still says it was the most terrifying and beautiful night of her life.',
        pIds['nancy'], [pIds['matthew'], pIds['paul'], pIds['nancy'], pIds['randy'], pIds['angela']], '1990s',

        'Aunt Karen\'s Last Thanksgiving',
        'Karen\'s last Thanksgiving with us was in 2018. She insisted on making her famous sweet potato casserole even though she could barely stand. Lynn helped her in the kitchen while the rest of us pretended not to notice how thin she\'d gotten. After dinner, she pulled each of the nieces and nephews aside and told them something she loved about them. Angela still has the note Karen slipped into her pocket that day. We miss her every holiday, but especially at Thanksgiving.',
        pIds['nancy'], [pIds['aunt_karen'], pIds['lynn'], pIds['angela']], '2010s',
      ]
    );

    const tripIds = {};
    async function createTrip(key, data) {
      const { rows } = await client.query(
        `INSERT INTO trips (name, location, description, start_date, end_date, status, planner_ids) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [data.name, data.location, data.description, data.start_date, data.end_date, data.status, data.planner_ids]
      );
      tripIds[key] = rows[0].id;
    }

    await createTrip('reunion', {
      name: 'Nash Family Reunion 2025',
      location: 'Indian Lake, Ohio',
      description: 'Annual Nash family reunion at the lake house. Three days of fishing, grilling, and catching up.',
      start_date: '2025-07-03',
      end_date: '2025-07-06',
      status: 'planning',
      planner_ids: [pIds['nancy'], pIds['angela']],
    });
    await createTrip('lakehouse', {
      name: 'Lake House Weekend',
      location: 'Indian Lake, Ohio',
      description: 'A quick weekend getaway. Just the core crew. Fishing, bonfires, and Dad\'s famous burgers.',
      start_date: '2025-05-23',
      end_date: '2025-05-25',
      status: 'confirmed',
      planner_ids: [pIds['randy']],
    });
    await createTrip('christmas', {
      name: 'Christmas at Mom & Dad\'s',
      location: 'The Nash Home, Dayton, OH',
      description: 'Christmas Eve through the 26th. Secret Santa, Nancy\'s chicken and dumplings, and way too many cookies.',
      start_date: '2025-12-24',
      end_date: '2025-12-26',
      status: 'planning',
      planner_ids: [pIds['nancy']],
    });

    const reunionParticipants = ['randy', 'nancy', 'angela', 'brian', 'james', 'lisa', 'jonathan', 'nicole', 'andrew', 'matthew', 'megan', 'paul', 'martin', 'ava', 'nash_g', 'mason', 'harvey', 'vivian', 'ethan', 'emmett', 'ella', 'craig', 'annie', 'maddison'];
    for (const p of reunionParticipants) {
      await client.query(
        `INSERT INTO trip_participants (trip_id, person_id, status) VALUES ($1, $2, $3)`,
        [tripIds['reunion'], pIds[p], 'accepted']
      );
    }

    const lakehouseParticipants = ['randy', 'nancy', 'james', 'jonathan', 'andrew', 'matthew', 'paul'];
    for (const p of lakehouseParticipants) {
      await client.query(
        `INSERT INTO trip_participants (trip_id, person_id, status) VALUES ($1, $2, $3)`,
        [tripIds['lakehouse'], pIds[p], 'accepted']
      );
    }

    const christmasParticipants = ['randy', 'nancy', 'angela', 'brian', 'james', 'lisa', 'jonathan', 'nicole', 'andrew', 'matthew', 'megan', 'paul', 'martin', 'ava', 'austin', 'nash_g', 'mason', 'harvey', 'vivian', 'ethan', 'emmett', 'ella'];
    for (const p of christmasParticipants) {
      await client.query(
        `INSERT INTO trip_participants (trip_id, person_id, status) VALUES ($1, $2, $3)`,
        [tripIds['christmas'], pIds[p], 'invited']
      );
    }

    await client.query(
      `INSERT INTO family_settings (family_name, tagline) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      ['The Nash Family', 'Our connected universe']
    );

    await client.query('COMMIT');
    const { rows: peopleCount } = await client.query('SELECT COUNT(*) as count FROM people');
    const { rows: householdCount } = await client.query('SELECT COUNT(*) as count FROM households');
    const { rows: relCount } = await client.query('SELECT COUNT(*) as count FROM relationships');
    console.log(`Seed complete: ${peopleCount[0].count} people, ${householdCount[0].count} households, ${relCount[0].count} relationships`);
    return {
      seeded: true,
      message: `Seeded ${peopleCount[0].count} people, ${householdCount[0].count} households, ${relCount[0].count} relationships`
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', error);
    throw error;
  } finally {
    client.release();
  }
}
