-- database/schema.sql
-- Creates the FoodBridge database and tables. Safe to run more than once.

CREATE DATABASE IF NOT EXISTS foodbridge_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE foodbridge_db;

-- USERS: everyone who can log in
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,          -- bcrypt hash, never the password
  role          ENUM('DONOR', 'NGO', 'ADMIN') NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- DONATIONS: food listed by donors, optionally claimed by an NGO
CREATE TABLE IF NOT EXISTS donations (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  donor_id          INT UNSIGNED NOT NULL,       -- user who created it
  claimed_by_ngo_id INT UNSIGNED NULL,           -- NGO that claimed it (NULL = unclaimed)
  food_name         VARCHAR(100) NOT NULL,
  description       VARCHAR(500) NULL,
  category          ENUM('COOKED_MEAL', 'BAKERY', 'FRUITS_VEGETABLES', 'PACKAGED', 'DAIRY', 'OTHER') NOT NULL,
  quantity          INT UNSIGNED NOT NULL,
  unit              ENUM('PORTIONS', 'KG', 'ITEMS', 'LITRES') NOT NULL,
  prepared_at       DATETIME NULL,
  expires_at        DATETIME NOT NULL,           -- collect-before deadline
  pickup_address    VARCHAR(255) NOT NULL,       -- full address, only for the claiming NGO
  pickup_area       VARCHAR(100) NOT NULL,       -- public locality, shown to all NGOs
  status            ENUM('AVAILABLE', 'ACCEPTED', 'COLLECTED', 'CANCELLED', 'EXPIRED')
                    NOT NULL DEFAULT 'AVAILABLE',
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_donations_donor
    FOREIGN KEY (donor_id) REFERENCES users (id),
  CONSTRAINT fk_donations_ngo
    FOREIGN KEY (claimed_by_ngo_id) REFERENCES users (id),
  CONSTRAINT chk_quantity_positive CHECK (quantity > 0),
  CONSTRAINT chk_prepared_before_expiry CHECK (prepared_at IS NULL OR prepared_at < expires_at),
  -- A claimed donation must name its NGO; an unclaimed one must not.
  CONSTRAINT chk_claim_matches_status CHECK (
    (status IN ('ACCEPTED', 'COLLECTED') AND claimed_by_ngo_id IS NOT NULL)
    OR
    (status IN ('AVAILABLE', 'CANCELLED', 'EXPIRED') AND claimed_by_ngo_id IS NULL)
  ),
  KEY idx_donations_status_expiry (status, expires_at),
  KEY idx_donations_donor (donor_id),
  KEY idx_donations_ngo (claimed_by_ngo_id)
) ENGINE=InnoDB;

-- SESSIONS: login sessions (used by express-mysql-session)
CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  expires    INT UNSIGNED NOT NULL,
  data       MEDIUMTEXT COLLATE utf8mb4_bin,
  PRIMARY KEY (session_id)
) ENGINE=InnoDB;
