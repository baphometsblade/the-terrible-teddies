-- Purchases: records every successful Stripe checkout
CREATE TABLE IF NOT EXISTS purchases (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  bundle_id        TEXT        NOT NULL,
  gems_granted     INTEGER     NOT NULL CHECK (gems_granted > 0),
  stripe_session_id TEXT       UNIQUE NOT NULL,
  amount_paid      INTEGER     NOT NULL,      -- cents (USD)
  status           TEXT        NOT NULL DEFAULT 'completed',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User gem balances (authoritative server-side record)
CREATE TABLE IF NOT EXISTS user_gems (
  user_id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gems             INTEGER     NOT NULL DEFAULT 0 CHECK (gems >= 0),
  total_purchased  INTEGER     NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Atomic gem credit (idempotency handled at call site via UNIQUE stripe_session_id)
CREATE OR REPLACE FUNCTION add_user_gems(p_user_id UUID, p_gems INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_gems (user_id, gems, total_purchased)
  VALUES (p_user_id, p_gems, p_gems)
  ON CONFLICT (user_id) DO UPDATE SET
    gems            = user_gems.gems + p_gems,
    total_purchased = user_gems.total_purchased + p_gems,
    updated_at      = NOW();
END;
$$;

-- RLS
ALTER TABLE purchases  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_gems  ENABLE ROW LEVEL SECURITY;

-- Users can only read their own records
CREATE POLICY "purchases_select_own"
  ON purchases FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_gems_select_own"
  ON user_gems FOR SELECT USING (auth.uid() = user_id);

-- Service role (webhook) can insert/update freely (bypasses RLS)
