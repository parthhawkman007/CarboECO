import subprocess
import os
import tempfile

def test_alembic_upgrade_head():
    # Use a temporary SQLite database file for testing migrations
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name
    
    try:
        # Override DATABASE_URL to a synchronous SQLite URL for Alembic's sync engine
        env = os.environ.copy()
        env["DATABASE_URL"] = f"sqlite:///{db_path}"
        
        # Run alembic upgrade head from the backend directory
        backend_dir = os.path.dirname(os.path.dirname(__file__))
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            cwd=backend_dir,
            env=env,
            capture_output=True,
            text=True
        )
        
        # Verify the migration run completed successfully
        assert result.returncode == 0, f"Alembic migration failed: {result.stderr}\nOutput: {result.stdout}"
    finally:
        # Clean up the temporary database file
        if os.path.exists(db_path):
            try:
                os.remove(db_path)
            except OSError:
                pass
