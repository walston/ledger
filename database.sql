CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Accounts
-- | user_id | user_name | hashed_password | salt |
CREATE TABLE accounts (
  id UUID PRIMARY KEY NOT NULL,
  username VARCHAR(24) UNIQUE NOT NULL,
  hashed_password TEXT NOT NULL,
  salt TEXT NOT NULL
);
--
-- AuthenticationTokens
-- | account_id | token | expiry |
CREATE TABLE authentication_tokens (
  id UUID references accounts(id),
  fingerprint TEXT NOT NULL,
  token VARCHAR(256) NOT NULL,
  expiry TIMESTAMP NOT NULL DEFAULT NOW()
);
--
-- Group
-- | ledger_id | group_name |
CREATE TABLE ledgers (
  id UUID PRIMARY KEY NOT NULL,
  ledger_name VARCHAR(24) NOT NULL
);
--
-- GroupUsers
-- | ledger_id | user_id |
CREATE TABLE user_access_to_ledgers (
  account_id UUID references accounts(id),
  ledger_id UUID references ledgers(id)
);
--
-- Transactions
-- | transaction_id | label | amount | date | user_id | ledger_id |
CREATE TABLE transactions (
  transaction_id UUID PRIMARY KEY NOT NULL,
  label VARCHAR(24) NOT NULL,
  amount MONEY NOT NULL,
  datetime TIMESTAMP NOT NULL,
  account_id UUID references accounts(id),
  ledger_id UUID references ledgers(id)
);
