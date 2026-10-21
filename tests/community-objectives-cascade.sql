-- Disposable fixture ONLY. The transaction restores every row.
-- Run after race tests, with completed mission/reward/ledger/evidence present.
BEGIN;
SELECT community_test.actor(1);
DELETE FROM public.servers WHERE id=community_test.id('a');
SELECT community_test.assert(NOT EXISTS(SELECT FROM public.community_mission_progress WHERE server_id=community_test.id('a')),'existing server deletion cascades mission rows');
SELECT community_test.assert(NOT EXISTS(SELECT FROM security_private.community_mission_evidence WHERE server_id=community_test.id('a')),'existing server deletion cascades private evidence');
SELECT community_test.assert(NOT EXISTS(SELECT FROM public.community_achievement_unlocks WHERE server_id=community_test.id('a')),'existing server deletion cascades community achievements');
ROLLBACK;
