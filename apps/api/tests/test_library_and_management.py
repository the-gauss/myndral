import asyncpg
import pytest
from httpx import ASGITransport, AsyncClient
from uuid import uuid4

from myndral_api.auth_utils import create_access_token
from myndral_api.main import app

TEST_DSN = "postgresql://myndral:myndral@localhost:5432/myndral"


async def _seed_catalog() -> dict[str, str]:
    conn = await asyncpg.connect(TEST_DSN)
    suffix = uuid4().hex[:8]
    usernames = {
        "admin": f"it_admin_{suffix}",
        "alice": f"it_alice_{suffix}",
        "bob": f"it_bob_{suffix}",
    }
    artist_slug = f"signal-bloom-{suffix}"
    try:
        await conn.execute(
            """
INSERT INTO subscription_plans (slug, display_name, price_cents, currency, billing_interval, sort_order)
VALUES
  ('free', 'Free', 0, 'USD', NULL, 0),
  ('premium_monthly', 'Premium Monthly', 499, 'USD', 'monthly', 1),
  ('premium_annual', 'Premium Annual', 3999, 'USD', 'annual', 2)
ON CONFLICT (slug) DO NOTHING
"""
        )

        admin_id = await conn.fetchval(
            """
INSERT INTO users (username, email, display_name, hashed_password, role, is_active, email_verified)
VALUES ($1, $2, 'Integration Admin', 'integration-test', 'admin', true, true)
RETURNING id::text
""",
            usernames["admin"],
            f"{usernames['admin']}@example.com",
        )
        alice_id = await conn.fetchval(
            """
INSERT INTO users (username, email, display_name, hashed_password, role, is_active, email_verified)
VALUES ($1, $2, 'Integration Alice', 'integration-test', 'listener', true, true)
RETURNING id::text
""",
            usernames["alice"],
            f"{usernames['alice']}@example.com",
        )
        bob_id = await conn.fetchval(
            """
INSERT INTO users (username, email, display_name, hashed_password, role, is_active, email_verified)
VALUES ($1, $2, 'Integration Bob', 'integration-test', 'listener', true, true)
RETURNING id::text
""",
            usernames["bob"],
            f"{usernames['bob']}@example.com",
        )

        artist_id = await conn.fetchval(
            """
INSERT INTO artists (name, slug, bio, status, published_at)
VALUES ('Signal Bloom', $1, 'Synthetic alt-pop for integration tests.', 'published', now())
RETURNING id::text
""",
            artist_slug,
        )
        album_id = await conn.fetchval(
            """
INSERT INTO albums (
  title,
  slug,
  artist_id,
  description,
  release_date,
  album_type,
  status,
  published_at
)
VALUES (
  'Afterglow Unit',
  'afterglow-unit',
  $1::uuid,
  'Integration test release.',
  CURRENT_DATE,
  'album',
  'published',
  now()
)
RETURNING id::text
""",
            artist_id,
        )

        track_one_id = await conn.fetchval(
            """
INSERT INTO tracks (
  title,
  album_id,
  primary_artist_id,
  track_number,
  duration_ms,
  status,
  published_at
)
VALUES (
  'Northbound Static',
  $1::uuid,
  $2::uuid,
  1,
  211000,
  'published',
  now()
)
RETURNING id::text
""",
            album_id,
            artist_id,
        )
        track_two_id = await conn.fetchval(
            """
INSERT INTO tracks (
  title,
  album_id,
  primary_artist_id,
  track_number,
  duration_ms,
  status,
  published_at
)
VALUES (
  'Glass Current',
  $1::uuid,
  $2::uuid,
  2,
  198000,
  'published',
  now()
)
RETURNING id::text
""",
            album_id,
            artist_id,
        )

        await conn.execute(
            """
INSERT INTO track_audio_files (track_id, quality, format, storage_url, duration_ms)
VALUES
  ($1::uuid, 'high_320', 'mp3', 'data/audio/northbound-static.mp3', 211000),
  ($2::uuid, 'high_320', 'mp3', 'data/audio/glass-current.mp3', 198000)
""",
            track_one_id,
            track_two_id,
        )

        await conn.execute(
            "UPDATE albums SET track_count = 2 WHERE id = $1::uuid",
            album_id,
        )

        bob_playlist_id = await conn.fetchval(
            """
INSERT INTO playlists (
  name,
  description,
  owner_id,
  is_public,
  track_count,
  total_duration_ms
)
VALUES (
  'Bob Public Mix',
  'A public mix for library save tests.',
  $1::uuid,
  true,
  1,
  211000
)
RETURNING id::text
""",
            bob_id,
        )
        await conn.execute(
            """
INSERT INTO playlist_tracks (playlist_id, track_id, position, added_by)
VALUES ($1::uuid, $2::uuid, 0, $3::uuid)
""",
            bob_playlist_id,
            track_one_id,
            bob_id,
        )

        return {
            "alice_id": alice_id,
            "bob_id": bob_id,
            "admin_id": admin_id,
            "usernames": usernames,
            "artist_slug": artist_slug,
            "artist_id": artist_id,
            "album_id": album_id,
            "track_one_id": track_one_id,
            "track_two_id": track_two_id,
            "bob_playlist_id": bob_playlist_id,
        }
    except Exception:
        await conn.execute(
            "DELETE FROM users WHERE username = ANY($1::text[])",
            list(usernames.values()),
        )
        await conn.execute("DELETE FROM artists WHERE slug = $1", artist_slug)
        raise
    finally:
        await conn.close()


async def _cleanup_catalog(seeded: dict[str, str]) -> None:
    conn = await asyncpg.connect(TEST_DSN)
    try:
        await conn.execute(
            "DELETE FROM users WHERE username = ANY($1::text[])",
            list(seeded["usernames"].values()),
        )
        await conn.execute("DELETE FROM artists WHERE slug = $1", seeded["artist_slug"])
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_library_playlist_and_admin_management_endpoints() -> None:
    seeded = await _seed_catalog()
    try:
        alice_token, _ = create_access_token(seeded["alice_id"])
        admin_token, _ = create_access_token(seeded["admin_id"])

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            alice_headers = {"Authorization": f"Bearer {alice_token}"}
            admin_headers = {"Authorization": f"Bearer {admin_token}"}

            # Save/favorite across the core entity types.
            assert (await client.put(f"/v1/users/me/library/tracks/{seeded['track_one_id']}", headers=alice_headers)).status_code == 200
            assert (await client.put(f"/v1/tracks/{seeded['track_one_id']}/like", headers=alice_headers)).status_code == 200
            assert (await client.put(f"/v1/albums/{seeded['album_id']}/save", headers=alice_headers)).status_code == 200
            assert (await client.put(f"/v1/users/me/favorites/albums/{seeded['album_id']}", headers=alice_headers)).status_code == 200
            assert (await client.put(f"/v1/artists/{seeded['artist_id']}/follow", headers=alice_headers)).status_code == 200
            assert (await client.put(f"/v1/users/me/favorites/artists/{seeded['artist_id']}", headers=alice_headers)).status_code == 200
            assert (await client.put(f"/v1/users/me/library/playlists/{seeded['bob_playlist_id']}", headers=alice_headers)).status_code == 200

            # Create and mutate a playlist through the listener API.
            created_playlist = (
                await client.post(
                    "/v1/playlists/",
                    headers=alice_headers,
                    json={
                        "name": "Road Tests",
                        "description": "API integration playlist",
                        "isPublic": False,
                        "trackIds": [seeded["track_one_id"]],
                    },
                )
            )
            assert created_playlist.status_code == 201
            playlist_id = created_playlist.json()["id"]

            add_track = await client.post(
                f"/v1/playlists/{playlist_id}/tracks",
                headers=alice_headers,
                json={"trackIds": [seeded["track_two_id"]]},
            )
            assert add_track.status_code == 200
            assert add_track.json()["trackCount"] == 2

            reorder = await client.put(
                f"/v1/playlists/{playlist_id}/tracks/reorder",
                headers=alice_headers,
                json={"trackIds": [seeded["track_two_id"], seeded["track_one_id"]]},
            )
            assert reorder.status_code == 200
            assert [track["id"] for track in reorder.json()["tracks"]] == [
                seeded["track_two_id"],
                seeded["track_one_id"],
            ]

            remove_track = await client.request(
                "DELETE",
                f"/v1/playlists/{playlist_id}/tracks",
                headers=alice_headers,
                json={"trackIds": [seeded["track_one_id"]]},
            )
            assert remove_track.status_code == 200
            assert remove_track.json()["trackCount"] == 1

            # Read back the collection state the apps will depend on.
            collection_state = await client.get(
                "/v1/users/me/collection-state",
                headers=alice_headers,
                params={
                    "trackIds": [seeded["track_one_id"], seeded["track_two_id"]],
                    "albumIds": [seeded["album_id"]],
                    "artistIds": [seeded["artist_id"]],
                    "playlistIds": [seeded["bob_playlist_id"], playlist_id],
                },
            )
            assert collection_state.status_code == 200
            state = collection_state.json()
            assert state["library"]["trackIds"] == [seeded["track_one_id"]]
            assert state["favorites"]["trackIds"] == [seeded["track_one_id"]]
            assert state["library"]["albumIds"] == [seeded["album_id"]]
            assert state["favorites"]["albumIds"] == [seeded["album_id"]]
            assert state["library"]["artistIds"] == [seeded["artist_id"]]
            assert state["favorites"]["artistIds"] == [seeded["artist_id"]]
            assert set(state["library"]["playlistIds"]) == {seeded["bob_playlist_id"], playlist_id}

            # Library and favorites pages use these endpoints directly.
            library_tracks = await client.get("/v1/users/me/library/tracks", headers=alice_headers)
            favorite_tracks = await client.get("/v1/users/me/favorites/tracks", headers=alice_headers)
            library_albums = await client.get("/v1/users/me/library/albums", headers=alice_headers)
            library_artists = await client.get("/v1/users/me/library/artists", headers=alice_headers)
            library_playlists = await client.get("/v1/users/me/library/playlists", headers=alice_headers)
            editable_playlists = await client.get(
                "/v1/users/me/playlists",
                headers=alice_headers,
                params={"editableOnly": "true"},
            )

            assert library_tracks.status_code == 200
            assert favorite_tracks.status_code == 200
            assert library_albums.status_code == 200
            assert library_artists.status_code == 200
            assert library_playlists.status_code == 200
            assert editable_playlists.status_code == 200
            assert library_tracks.json()["items"][0]["id"] == seeded["track_one_id"]
            assert favorite_tracks.json()["items"][0]["id"] == seeded["track_one_id"]
            assert library_albums.json()["items"][0]["id"] == seeded["album_id"]
            assert library_artists.json()["items"][0]["id"] == seeded["artist_id"]
            assert {item["id"] for item in library_playlists.json()["items"]} == {
                seeded["bob_playlist_id"],
                playlist_id,
            }
            assert [item["id"] for item in editable_playlists.json()["items"]] == [playlist_id]

            # Admin user management powers the Studio panel.
            plans_response = await client.get("/v1/internal/subscription-plans", headers=admin_headers)
            users_response = await client.get(
                "/v1/internal/users",
                headers=admin_headers,
                params={"q": seeded["usernames"]["bob"]},
            )
            assert plans_response.status_code == 200
            assert users_response.status_code == 200
            assert any(plan["slug"] == "premium_annual" for plan in plans_response.json())
            bob = users_response.json()["items"][0]
            assert bob["username"] == seeded["usernames"]["bob"]

            update_bob = await client.patch(
                f"/v1/internal/users/{seeded['bob_id']}",
                headers=admin_headers,
                json={
                    "role": "content_editor",
                    "subscriptionPlan": "premium_annual",
                    "isActive": True,
                },
            )
            assert update_bob.status_code == 200
            updated_bob = update_bob.json()
            assert updated_bob["role"] == "content_editor"
            assert updated_bob["subscriptionPlan"] == "premium_annual"
            assert updated_bob["isActive"] is True
            assert "catalog_write" in updated_bob["privileges"]
            assert "premium_exports" in updated_bob["privileges"]
    finally:
        await _cleanup_catalog(seeded)
