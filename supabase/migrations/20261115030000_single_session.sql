-- Keep the oldest valid session per account when upgrading existing installations.
DELETE FROM app.sessions WHERE expires_at <= to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
DELETE FROM app.sessions WHERE id IN (
 SELECT id FROM (SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY expires_at,id) AS position FROM app.sessions) duplicates WHERE position>1
);
CREATE UNIQUE INDEX one_session_per_user ON app.sessions(user_id);
