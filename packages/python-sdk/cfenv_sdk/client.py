from __future__ import annotations

import hashlib
import json
import os
import threading
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Callable, Dict, Optional

import requests


class CfenvError(Exception):
    pass


@dataclass(frozen=True)
class FlatEnvMetadata:
    checksum: str
    updated_at: str
    updated_by: Optional[str]
    entries_count: int


@dataclass(frozen=True)
class HotUpdateSnapshot:
    project: str
    environment: str
    namespace_id: str
    metadata: FlatEnvMetadata
    entries: Dict[str, str]


def _canonicalize_entries(entries: Dict[str, str]) -> str:
    parts = []
    for key in sorted(entries):
        # Match Node checksum logic: `${key}=${JSON.stringify(value)}`
        parts.append(f"{key}={json.dumps(entries[key], ensure_ascii=True, separators=(',', ':'))}")
    return "\n".join(parts)


def checksum_entries(entries: Dict[str, str]) -> str:
    canonical = _canonicalize_entries(entries)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class CfenvClient:
    def __init__(
        self,
        *,
        account_id: str,
        api_token: str,
        namespace_id: str,
        project: str,
        environment: str,
        key_prefix: str = "cfenv",
        timeout_seconds: float = 15.0,
        max_retries: int = 3,
        retry_base_seconds: float = 0.5,
        session: Optional[requests.Session] = None,
    ) -> None:
        if not account_id:
            raise ValueError("account_id is required")
        if not api_token:
            raise ValueError("api_token is required")
        if not namespace_id:
            raise ValueError("namespace_id is required")
        if not project:
            raise ValueError("project is required")
        if not environment:
            raise ValueError("environment is required")

        self.account_id = account_id
        self.api_token = api_token
        self.namespace_id = namespace_id
        self.project = project
        self.environment = environment
        self.key_prefix = key_prefix
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.retry_base_seconds = retry_base_seconds
        self.session = session or requests.Session()

    @property
    def _base_key(self) -> str:
        return f"{self.key_prefix}:{self.project}:{self.environment}"

    @property
    def _vars_prefix(self) -> str:
        return f"{self._base_key}:vars:"

    @property
    def _meta_key(self) -> str:
        return f"{self._base_key}:meta"

    @property
    def _base_api(self) -> str:
        return f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}"

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_token}",
            "User-Agent": "cfenv-kv-sync-python/0.1.0",
        }

    def _request(self, method: str, url: str, **kwargs) -> requests.Response:
        last_error: Optional[Exception] = None
        for attempt in range(self.max_retries + 1):
            try:
                response = self.session.request(
                    method=method,
                    url=url,
                    headers=self._headers(),
                    timeout=self.timeout_seconds,
                    **kwargs,
                )
                if response.status_code in (408, 429) or response.status_code >= 500:
                    if attempt < self.max_retries:
                        retry_after = response.headers.get("Retry-After")
                        if retry_after is not None:
                            wait_seconds = self._parse_retry_after(retry_after)
                        else:
                            wait_seconds = self.retry_base_seconds * (2 ** attempt)
                        time.sleep(wait_seconds)
                        continue
                return response
            except requests.RequestException as exc:
                last_error = exc
                if attempt >= self.max_retries:
                    break
                time.sleep(self.retry_base_seconds * (2 ** attempt))

        if last_error is not None:
            raise CfenvError(f"Cloudflare API network error: {last_error}") from last_error
        raise CfenvError("Cloudflare API request failed")

    @staticmethod
    def _parse_retry_after(value: str) -> float:
        value = value.strip()
        try:
            return max(0.0, float(value))
        except ValueError:
            try:
                retry_time = datetime.strptime(value, "%a, %d %b %Y %H:%M:%S %Z")
                delta = (retry_time - datetime.utcnow()).total_seconds()
                return max(0.0, delta)
            except ValueError:
                return 0.5

    def _parse_json_envelope(self, response: requests.Response) -> dict:
        try:
            payload = response.json()
        except ValueError as exc:
            raise CfenvError(f"Cloudflare API returned non-JSON response ({response.status_code})") from exc

        if response.status_code >= 400 or not payload.get("success", False):
            errors = payload.get("errors", [])
            messages = [item.get("message", "") for item in errors if isinstance(item, dict)]
            message = "; ".join([m for m in messages if m]) or f"Cloudflare API request failed ({response.status_code})"
            raise CfenvError(message)
        return payload

    def _get_value(self, key: str) -> Optional[str]:
        url = f"{self._base_api}/storage/kv/namespaces/{self.namespace_id}/values/{requests.utils.quote(key, safe='')}"
        response = self._request("GET", url)
        if response.status_code == 404:
            return None
        if response.status_code >= 400:
            raise CfenvError(f"Failed to read KV key {key} ({response.status_code})")
        return response.text

    def _list_keys(self, prefix: str, limit: int = 1000) -> list[str]:
        keys: list[str] = []
        cursor: Optional[str] = None
        while True:
            params = {"prefix": prefix, "limit": str(limit)}
            if cursor:
                params["cursor"] = cursor
            url = f"{self._base_api}/storage/kv/namespaces/{self.namespace_id}/keys"
            response = self._request("GET", url, params=params)
            payload = self._parse_json_envelope(response)
            result = payload.get("result", [])
            for item in result:
                name = item.get("name")
                if isinstance(name, str):
                    keys.append(name)
            info = payload.get("result_info") or {}
            cursor = info.get("cursor")
            if not cursor:
                break
        return keys

    def fetch_flat_env(self) -> HotUpdateSnapshot:
        raw_meta = self._get_value(self._meta_key)
        if raw_meta is None:
            raise CfenvError("No flat metadata found for this target")

        try:
            meta_obj = json.loads(raw_meta)
        except ValueError as exc:
            raise CfenvError("Invalid flat metadata payload") from exc

        metadata = FlatEnvMetadata(
            checksum=str(meta_obj.get("checksum", "")),
            updated_at=str(meta_obj.get("updatedAt", "")),
            updated_by=meta_obj.get("updatedBy"),
            entries_count=int(meta_obj.get("entriesCount", 0)),
        )
        if not metadata.checksum:
            raise CfenvError("Flat metadata missing checksum")

        entries: Dict[str, str] = {}
        for key in sorted(self._list_keys(self._vars_prefix)):
            var_name = key[len(self._vars_prefix) :]
            value = self._get_value(key)
            if value is not None:
                entries[var_name] = value

        computed = checksum_entries(entries)
        if computed != metadata.checksum:
            raise CfenvError("Flat env checksum mismatch")

        return HotUpdateSnapshot(
            project=self.project,
            environment=self.environment,
            namespace_id=self.namespace_id,
            metadata=metadata,
            entries=entries,
        )

    def export_dotenv(self) -> str:
        snapshot = self.fetch_flat_env()
        lines = []
        for key in sorted(snapshot.entries):
            lines.append(f"{key}={json.dumps(snapshot.entries[key], ensure_ascii=True, separators=(',', ':'))}")
        return "\n".join(lines) + "\n"

    def export_json(self) -> str:
        snapshot = self.fetch_flat_env()
        return json.dumps(snapshot.entries, ensure_ascii=False, indent=2) + "\n"

    def apply_to_process_env(self, overwrite: bool = True) -> HotUpdateSnapshot:
        snapshot = self.fetch_flat_env()
        for key, value in snapshot.entries.items():
            if not overwrite and key in os.environ:
                continue
            os.environ[key] = value
        return snapshot

    def create_hot_updater(
        self,
        *,
        on_update: Callable[[HotUpdateSnapshot, str], None],
        on_error: Optional[Callable[[Exception], None]] = None,
        interval_seconds: float = 30.0,
        max_interval_seconds: float = 300.0,
        bootstrap: bool = True,
    ) -> "HotUpdater":
        return HotUpdater(
            client=self,
            on_update=on_update,
            on_error=on_error,
            interval_seconds=interval_seconds,
            max_interval_seconds=max_interval_seconds,
            bootstrap=bootstrap,
        )


class HotUpdater:
    def __init__(
        self,
        *,
        client: CfenvClient,
        on_update: Callable[[HotUpdateSnapshot, str], None],
        on_error: Optional[Callable[[Exception], None]],
        interval_seconds: float,
        max_interval_seconds: float,
        bootstrap: bool,
    ) -> None:
        self.client = client
        self.on_update = on_update
        self.on_error = on_error
        self.interval_seconds = max(1.0, interval_seconds)
        self.max_interval_seconds = max(self.interval_seconds, max_interval_seconds)
        self.bootstrap = bootstrap
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._last_checksum: Optional[str] = None
        self._consecutive_errors = 0

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run_loop, name="cfenv-hot-updater", daemon=True)
        self._thread.start()

    def stop(self, timeout: Optional[float] = None) -> None:
        self._running = False
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=timeout)

    def is_running(self) -> bool:
        return self._running

    def _run_loop(self) -> None:
        delay = self.interval_seconds
        if self.bootstrap:
            self._refresh("initial")

        while not self._stop_event.wait(delay):
            ok = self._refresh("changed")
            if ok:
                self._consecutive_errors = 0
                delay = self.interval_seconds
            else:
                self._consecutive_errors += 1
                delay = min(self.max_interval_seconds, self.interval_seconds * (2 ** min(self._consecutive_errors, 6)))

    def _refresh(self, reason: str) -> bool:
        try:
            snapshot = self.client.fetch_flat_env()
            if snapshot.metadata.checksum == self._last_checksum:
                return True
            self._last_checksum = snapshot.metadata.checksum
            self.on_update(snapshot, reason)
            return True
        except Exception as exc:  # noqa: BLE001
            if self.on_error is not None:
                self.on_error(exc)
            return False
