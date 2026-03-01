-- Bartr initial schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    google_id       TEXT UNIQUE NOT NULL,
    nickname        TEXT UNIQUE NOT NULL,
    email_encrypted BYTEA,
    password_hash   TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_active     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_nickname ON users (nickname);

-- ============================================================
-- Categories (self-referencing for subcategories)
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
    id        SERIAL PRIMARY KEY,
    name      TEXT NOT NULL,
    slug      TEXT UNIQUE NOT NULL,
    parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories (parent_id);

-- ============================================================
-- Listings
-- ============================================================
CREATE TABLE IF NOT EXISTS listings (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title            TEXT NOT NULL,
    description      TEXT NOT NULL,
    category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    payment_methods  JSONB NOT NULL DEFAULT '[]',
    price_indication TEXT,
    currency         TEXT,
    status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'paused', 'sold', 'removed')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listings_user    ON listings (user_id);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings (category_id);
CREATE INDEX IF NOT EXISTS idx_listings_status  ON listings (status);

-- ============================================================
-- Listing images
-- ============================================================
CREATE TABLE IF NOT EXISTS listing_images (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    storage_key TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_listing_images_listing ON listing_images (listing_id);

-- ============================================================
-- Trades
-- ============================================================
CREATE TABLE IF NOT EXISTS trades (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    buyer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status     TEXT NOT NULL DEFAULT 'offered'
               CHECK (status IN ('offered', 'accepted', 'completed', 'declined', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trades_listing ON trades (listing_id);
CREATE INDEX IF NOT EXISTS idx_trades_buyer   ON trades (buyer_id);
CREATE INDEX IF NOT EXISTS idx_trades_seller  ON trades (seller_id);

-- ============================================================
-- Trade events (audit log)
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_events (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id   UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trade_events_trade ON trade_events (trade_id);

-- ============================================================
-- Ratings
-- ============================================================
CREATE TABLE IF NOT EXISTS ratings (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id     UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score        SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
    comment      TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (trade_id, from_user_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_to_user ON ratings (to_user_id);

-- ============================================================
-- Reputation scores (materialized by workers)
-- ============================================================
CREATE TABLE IF NOT EXISTS reputation_scores (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    composite_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    rating_avg      NUMERIC(3,2) NOT NULL DEFAULT 0,
    completion_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
    response_score  NUMERIC(5,4) NOT NULL DEFAULT 0,
    tenure_bonus    NUMERIC(5,4) NOT NULL DEFAULT 0,
    volume_score    NUMERIC(5,4) NOT NULL DEFAULT 0,
    dispute_rate    NUMERIC(5,4) NOT NULL DEFAULT 0,
    tier            TEXT NOT NULL DEFAULT 'new'
                    CHECK (tier IN ('new', 'verified', 'trusted', 'elite')),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Message threads
-- ============================================================
CREATE TABLE IF NOT EXISTS message_threads (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id    UUID REFERENCES listings(id) ON DELETE SET NULL,
    participant_1 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participant_2 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_threads_participants ON message_threads (participant_1, participant_2);

-- ============================================================
-- Messages
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id      UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
    sender_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body_encrypted BYTEA NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages (thread_id, created_at);

-- ============================================================
-- Moderation flags
-- ============================================================
CREATE TABLE IF NOT EXISTS moderation_flags (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('listing', 'user', 'message')),
    target_id   UUID NOT NULL,
    reason      TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moderation_flags_target ON moderation_flags (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_moderation_flags_status ON moderation_flags (status);
