CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    last_online DATETIME
);

CREATE TABLE IF NOT EXISTS invitation(

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    from_id INTEGER NOT NULL,
    to_id INTEGER NOT NULL,

    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (from_id) REFERENCES users(id),
    FOREIGN KEY (to_id) REFERENCES users(id),
	CONSTRAINT chk_status CHECK (
		status IN ('pending', 'accepted', 'declined')
	)
);

CREATE TRIGGER prevent_invalid_invite_update
BEFORE UPDATE OF status ON invitation
FOR EACH ROW
WHEN OLD.status != 'pending'
BEGIN
	SELECT RAISE(FAIL, 'Cannot modify non-pending invitation');
END;

CREATE TABLE IF NOT EXISTS match(

    invitation_id INTEGER PRIMARY KEY AUTOINCREMENT,

    from_score INTEGER NOT NULL DEFAULT 0,
    to_score INTEGER NOT NULL DEFAULT 0,

    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (invitation_id) REFERENCES invitation(id)
);
