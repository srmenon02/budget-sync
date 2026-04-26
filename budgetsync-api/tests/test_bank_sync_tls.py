import base64
from pathlib import Path

import pytest

from app.services import bank_sync


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload
        self.status_code = 200
        self.text = ""

    def raise_for_status(self) -> None:
        return None

    def json(self):
        return self._payload


@pytest.mark.asyncio
async def test_fetch_teller_accounts_without_tls_uses_default_verify(monkeypatch):
    monkeypatch.delenv("TELLER_CLIENT_CERT_B64", raising=False)
    monkeypatch.delenv("TELLER_CLIENT_KEY_B64", raising=False)
    monkeypatch.delenv("TELLER_CA_CERT_B64", raising=False)

    captured: dict[str, object] = {}

    class FakeAsyncClient:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, *_args, **_kwargs):
            return _FakeResponse([{"id": "acct_1"}])

    monkeypatch.setattr(bank_sync.httpx, "AsyncClient", FakeAsyncClient)

    accounts = await bank_sync.fetch_teller_accounts("access-token")

    assert accounts == [{"id": "acct_1"}]
    assert captured["timeout"] == 20.0
    assert captured["verify"] is True
    assert "cert" not in captured


@pytest.mark.asyncio
async def test_fetch_teller_accounts_with_tls_certificates(monkeypatch):
    cert_bytes = b"cert-bytes"
    key_bytes = b"key-bytes"
    ca_bytes = b"ca-bytes"

    monkeypatch.setenv(
        "TELLER_CLIENT_CERT_B64", base64.b64encode(cert_bytes).decode("utf-8")
    )
    monkeypatch.setenv(
        "TELLER_CLIENT_KEY_B64", base64.b64encode(key_bytes).decode("utf-8")
    )
    monkeypatch.setenv("TELLER_CA_CERT_B64", base64.b64encode(ca_bytes).decode("utf-8"))

    captured: dict[str, object] = {}

    class FakeAsyncClient:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        async def __aenter__(self):
            cert_path, key_path = captured["cert"]
            verify_path = captured["verify"]

            assert Path(cert_path).read_bytes() == cert_bytes
            assert Path(key_path).read_bytes() == key_bytes
            assert Path(verify_path).read_bytes() == ca_bytes
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, *_args, **_kwargs):
            return _FakeResponse([{"id": "acct_2"}])

    monkeypatch.setattr(bank_sync.httpx, "AsyncClient", FakeAsyncClient)

    accounts = await bank_sync.fetch_teller_accounts("access-token")

    cert_path, key_path = captured["cert"]
    verify_path = captured["verify"]

    assert accounts == [{"id": "acct_2"}]
    assert captured["timeout"] == 20.0
    assert isinstance(verify_path, str)
    assert not Path(cert_path).exists()
    assert not Path(key_path).exists()
    assert not Path(verify_path).exists()


@pytest.mark.asyncio
async def test_fetch_teller_accounts_rejects_partial_tls_pair(monkeypatch):
    cert_bytes = b"cert-only"
    monkeypatch.setenv(
        "TELLER_CLIENT_CERT_B64", base64.b64encode(cert_bytes).decode("utf-8")
    )
    monkeypatch.delenv("TELLER_CLIENT_KEY_B64", raising=False)
    monkeypatch.delenv("TELLER_CA_CERT_B64", raising=False)

    with pytest.raises(
        ValueError,
        match="TELLER_CLIENT_CERT_B64 and TELLER_CLIENT_KEY_B64 must both be set",
    ):
        await bank_sync.fetch_teller_accounts("access-token")
