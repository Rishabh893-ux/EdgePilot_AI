import os
import importlib
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ["DATABASE_URL"] = "sqlite:///./test_edgepilot.db"

import backend.database as database
import backend.auth as auth


class AuthFlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        importlib.reload(database)
        import backend.auth as auth_module
        importlib.reload(auth_module)
        database.init_db()

    def tearDown(self):
        database.engine.dispose()

    def test_register_login_and_token_flow(self):
        user = auth.create_user("alice_test", "secret123", "operator")
        self.assertEqual(user.username, "alice_test")
        self.assertEqual(user.role, "operator")

        authenticated = auth.authenticate_user("alice_test", "secret123")
        self.assertIsNotNone(authenticated)
        self.assertEqual(authenticated.username, "alice_test")

        token = auth.create_session_token(authenticated)
        self.assertTrue(token)

        resolved = auth.get_user_from_token(token)
        self.assertIsNotNone(resolved)
        self.assertEqual(resolved.username, "alice_test")

        revoked = auth.revoke_session_token(token)
        self.assertTrue(revoked)

        self.assertIsNone(auth.get_user_from_token(token))


if __name__ == "__main__":
    unittest.main()
