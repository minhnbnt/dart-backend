CREATE TABLE IF NOT EXISTS users(
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	username TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	last_online DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invitation(

	id INTEGER PRIMARY KEY AUTOINCREMENT,

	from_id INTEGER NOT NULL,
	to_id INTEGER NOT NULL,

	status TEXT NOT NULL DEFAULT 'pending',
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

	FOREIGN KEY (from_id) REFERENCES users(id),
	FOREIGN KEY (to_id) REFERENCES users(id),

	CONSTRAINT chk_not_self CHECK (from_id != to_id),
	CONSTRAINT chk_status CHECK (
		status IN ('pending', 'accepted', 'declined')
	)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_invite
ON invitation(from_id, to_id)
WHERE status = 'pending';

CREATE TRIGGER prevent_invalid_invite_update
BEFORE UPDATE OF status ON invitation
FOR EACH ROW
WHEN OLD.status != 'pending' AND NEW.status != OLD.status
BEGIN
	SELECT RAISE(FAIL, 'Cannot modify invitation.');
END;

CREATE TABLE IF NOT EXISTS match(
	invitation_id INTEGER PRIMARY KEY,
	played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	forfeited_by INTEGER DEFAULT NULL,

	FOREIGN KEY (invitation_id) REFERENCES invitation(id)
);

CREATE TRIGGER IF NOT EXISTS create_match_after_accept
AFTER UPDATE OF status ON invitation
FOR EACH ROW
WHEN NEW.status = 'accepted' AND OLD.status = 'pending'
BEGIN
	INSERT INTO match (invitation_id) VALUES (NEW.id);
END;

CREATE TABLE IF NOT EXISTS throw_attempt(

	match_id INTEGER NOT NULL,
	player_id INTEGER NOT NULL,

	attempt_number INTEGER NOT NULL CHECK (attempt_number BETWEEN 1 AND 3),
	score INTEGER NOT NULL CHECK (score >= 0),

	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

	PRIMARY KEY (match_id, player_id, attempt_number),

	FOREIGN KEY (match_id) REFERENCES match(id) ON DELETE CASCADE,
	FOREIGN KEY (player_id) REFERENCES users(id)
);

CREATE TRIGGER IF NOT EXISTS validate_throw_player
BEFORE INSERT ON throw_attempt
FOR EACH ROW
WHEN NEW.player_id NOT IN (
	SELECT from_id FROM invitation WHERE invitation.id = (
		SELECT invitation_id FROM match WHERE id = NEW.match_id
	)
	UNION
	SELECT to_id FROM invitation WHERE invitation.id = (
		SELECT invitation_id FROM match WHERE id = NEW.match_id
	)
)
BEGIN
    SELECT RAISE(FAIL, 'Player not part of this match');
END;

CREATE TRIGGER IF NOT EXISTS validate_forfeit_player
BEFORE INSERT OR UPDATE OF forfeited_by ON match
FOR EACH ROW
WHEN NEW.forfeited_by IS NOT NULL
  AND NEW.forfeited_by NOT IN (
	  SELECT from_id FROM invitation WHERE invitation.id = NEW.invitation_id
	  UNION
	  SELECT to_id FROM invitation WHERE invitation.id = NEW.invitation_id
  )
BEGIN
	SELECT RAISE(FAIL, 'Invalid forfeited_by: player not in this match');
END;
