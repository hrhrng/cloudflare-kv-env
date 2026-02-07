import os
import unittest

from cfenv_sdk.client import CfenvClient, CfenvError, checksum_entries


class FakeClient(CfenvClient):
    def __init__(self):
        super().__init__(
            account_id="a",
            api_token="t",
            namespace_id="n",
            project="demo",
            environment="development",
        )
        self._store = {}

    @property
    def _base_key(self):  # type: ignore[override]
        return "cfenv:demo:development"

    def _get_value(self, key):  # type: ignore[override]
        return self._store.get(key)

    def _list_keys(self, prefix, limit=1000):  # type: ignore[override]
        return [k for k in sorted(self._store) if k.startswith(prefix)]


def set_flat_payload(client: FakeClient, entries: dict[str, str]) -> None:
    checksum = checksum_entries(entries)
    base = "cfenv:demo:development"
    prefix = f"{base}:vars:"
    for key in [k for k in client._store if k.startswith(prefix)]:
        del client._store[key]

    client._store[f"{base}:meta"] = (
        '{"schema":1,"mode":"flat","checksum":"%s","updatedAt":"2026-01-01T00:00:00Z","updatedBy":"test","entriesCount":%d}'
        % (checksum, len(entries))
    )
    for key, value in entries.items():
        client._store[f"{base}:vars:{key}"] = value


class ClientTests(unittest.TestCase):
    def test_checksum(self):
        entries = {"B": "2", "A": "1"}
        c1 = checksum_entries(entries)
        c2 = checksum_entries({"A": "1", "B": "2"})
        self.assertEqual(c1, c2)

    def test_fetch_flat_env_success(self):
        client = FakeClient()
        entries = {"A": "1", "B": "2"}
        set_flat_payload(client, entries)

        snapshot = client.fetch_flat_env()
        self.assertEqual(snapshot.entries, entries)
        self.assertEqual(snapshot.metadata.entries_count, 2)

    def test_fetch_flat_env_checksum_mismatch(self):
        client = FakeClient()
        base = "cfenv:demo:development"
        client._store[f"{base}:meta"] = (
            '{"schema":1,"mode":"flat","checksum":"bad","updatedAt":"2026-01-01T00:00:00Z","updatedBy":"test","entriesCount":1}'
        )
        client._store[f"{base}:vars:A"] = "1"

        with self.assertRaises(CfenvError):
            client.fetch_flat_env()

    def test_export_and_apply_env(self):
        client = FakeClient()
        set_flat_payload(client, {"A": "1", "B": "2"})

        self.assertEqual(client.export_dotenv(), 'A="1"\nB="2"\n')
        self.assertEqual(client.export_json().strip(), '{\n  "A": "1",\n  "B": "2"\n}')

        original = os.environ.get("CFENV_TEST_VAR")
        os.environ["CFENV_TEST_VAR"] = "old"
        set_flat_payload(client, {"CFENV_TEST_VAR": "new"})

        try:
            client.apply_to_process_env(overwrite=False)
            self.assertEqual(os.environ.get("CFENV_TEST_VAR"), "old")

            client.apply_to_process_env(overwrite=True)
            self.assertEqual(os.environ.get("CFENV_TEST_VAR"), "new")
        finally:
            if original is None:
                os.environ.pop("CFENV_TEST_VAR", None)
            else:
                os.environ["CFENV_TEST_VAR"] = original

    def test_hot_updater_refreshes_only_on_checksum_change(self):
        client = FakeClient()
        set_flat_payload(client, {"A": "1"})

        updates = []
        errors = []

        updater = client.create_hot_updater(
            on_update=lambda snapshot, reason: updates.append((reason, snapshot.entries.copy())),
            on_error=lambda exc: errors.append(exc),
            bootstrap=False,
            interval_seconds=1.0,
            max_interval_seconds=2.0,
        )

        self.assertTrue(updater._refresh("initial"))
        self.assertEqual(len(updates), 1)

        self.assertTrue(updater._refresh("changed"))
        self.assertEqual(len(updates), 1)

        set_flat_payload(client, {"A": "2"})
        self.assertTrue(updater._refresh("changed"))
        self.assertEqual(len(updates), 2)
        self.assertEqual(updates[1][1]["A"], "2")
        self.assertEqual(len(errors), 0)


if __name__ == "__main__":
    unittest.main()
