-- Add recurring event instances table for tracking individual occurrences

CREATE TABLE IF NOT EXISTS recurring_event_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Instance-specific time (can be modified from parent)
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  
  -- Instance-specific overrides
  title TEXT, -- Override parent title if set
  description TEXT, -- Override parent description if set
  location TEXT, -- Override parent location if set
  meeting_url TEXT, -- Override parent meeting URL if set
  
  -- Status
  cancelled BOOLEAN DEFAULT false, -- Individual instance cancelled
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_recurring_instances_parent ON recurring_event_instances(parent_event_id);
CREATE INDEX IF NOT EXISTS idx_recurring_instances_tenant ON recurring_event_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recurring_instances_start ON recurring_event_instances(start_time);
CREATE INDEX IF NOT EXISTS idx_recurring_instances_cancelled ON recurring_event_instances(cancelled);



