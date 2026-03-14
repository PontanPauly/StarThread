const API_BASE = '/api';

class EntityProxy {
  constructor(entityType) {
    this.entityType = entityType;
  }

  async list(sort, limit) {
    const params = new URLSearchParams();
    if (sort) params.append('sort', sort);
    if (limit) params.append('limit', limit);
    
    const url = `${API_BASE}/entities/${this.entityType}${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url, { credentials: 'include' });
    
    if (!response.ok) {
      throw new Error(`Failed to list ${this.entityType}`);
    }
    return response.json();
  }

  async filter(filters) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value);
      }
    });
    
    const url = `${API_BASE}/entities/${this.entityType}/filter?${params.toString()}`;
    const response = await fetch(url, { credentials: 'include' });
    
    if (!response.ok) {
      throw new Error(`Failed to filter ${this.entityType}`);
    }
    return response.json();
  }

  async create(data) {
    const response = await fetch(`${API_BASE}/entities/${this.entityType}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      let message = `Failed to create ${this.entityType}`;
      try { const body = await response.json(); if (body.error) message = body.error; } catch {}
      throw new Error(message);
    }
    return response.json();
  }

  async update(id, data) {
    const response = await fetch(`${API_BASE}/entities/${this.entityType}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      let message = `Failed to update ${this.entityType}`;
      try { const body = await response.json(); if (body.error) message = body.error; } catch {}
      throw new Error(message);
    }
    return response.json();
  }

  async delete(id) {
    const response = await fetch(`${API_BASE}/entities/${this.entityType}/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    
    if (!response.ok) {
      let message = `Failed to delete ${this.entityType}`;
      try { const body = await response.json(); if (body.error) message = body.error; } catch {}
      throw new Error(message);
    }
    return response.json();
  }
}

class AuthProxy {
  async me() {
    const response = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
    if (!response.ok) {
      if (response.status === 401) {
        return null;
      }
      throw new Error('Failed to get current user');
    }
    return response.json();
  }

  async login(email, password) {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      let errorMessage = 'Login failed';
      try {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } catch {
        errorMessage = `Login failed (${response.status})`;
      }
      throw new Error(errorMessage);
    }
    return response.json();
  }

  async register(email, password, fullName, inviteCode, relationshipType) {
    const body = { email, password, full_name: fullName };
    if (inviteCode) body.invite_code = inviteCode;
    if (relationshipType) body.relationship_type = relationshipType;
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      let errorMessage = 'Registration failed';
      try {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } catch {
        errorMessage = `Registration failed (${response.status})`;
      }
      throw new Error(errorMessage);
    }
    return response.json();
  }

  async logout() {
    const response = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    return response.ok;
  }

  async myPerson() {
    const response = await fetch(`${API_BASE}/auth/my-person`, { credentials: 'include' });
    if (!response.ok) {
      if (response.status === 401) return null;
      throw new Error('Failed to get my person');
    }
    return response.json();
  }

  redirectToLogin() {
    window.location.href = '/login';
  }
}

class IntegrationsProxy {
  constructor() {
    this.Core = {
      UploadFile: async ({ file }) => {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${API_BASE}/upload`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error('File upload failed');
        }
        return response.json();
      }
    };
  }
}

class FunctionsProxy {
  async invoke(functionName, params = {}) {
    const response = await fetch(`${API_BASE}/functions/${functionName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });
    
    if (!response.ok) {
      let errorMsg = `Function ${functionName} failed`;
      try {
        const errBody = await response.json();
        if (errBody.error) errorMsg = errBody.error;
      } catch {}
      throw new Error(errorMsg);
    }
    return response.json();
  }
}

const entityTypes = [
  'Person', 'Trip', 'Household', 'Relationship', 'TripParticipant',
  'Meal', 'Room', 'Activity', 'Expense', 'PackingItem', 'SharedTripItem',
  'Moment', 'LoveNote', 'FamilyStory', 'FamilySettings', 'JoinRequest',
  'Ritual', 'Conversation', 'Message', 'CalendarEvent', 'RelationshipVisibility',
  'TrustedContact', 'InviteLink'
];

const entities = {};
entityTypes.forEach(type => {
  entities[type] = new EntityProxy(type);
});

export const base44 = {
  entities,
  auth: new AuthProxy(),
  integrations: new IntegrationsProxy(),
  functions: new FunctionsProxy(),
};
