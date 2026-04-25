# Database Setup and Troubleshooting

Because we are using SQLite for the Hackathon MVP, database state is stored entirely in the `db.sqlite3` file in the project root. While this is incredibly convenient, it can sometimes lead to migration conflicts during rapid development (like adding a custom user model after migrating).

This guide covers how to safely set up, wipe, and troubleshoot your database.

---

## 1. Initial Database Setup
If you are setting up the project for the very first time, run:

```bash
# Activate your virtual environment
source .venv/bin/activate

# Create the migration files (schema blueprints)
python manage.py makemigrations

# Apply the migrations to create db.sqlite3
python manage.py migrate
```

---

## 2. The Nuclear Option (Database Reset)

### When to use this:
- You get an `InconsistentMigrationHistory` error.
- You created a custom User model (`users.User`) *after* already running `migrate`.
- You messed up a model field and just want to start fresh (since this is an MVP without production data).

### How to reset safely:

Run the following commands in your terminal **exactly as written**. 

> [!WARNING]
> Do NOT use broad wildcard `find` commands unless you are certain they exclude your virtual environment (`.venv`), or you will accidentally delete Django's internal files!

```bash
# 1. Delete the corrupted database file
rm db.sqlite3

# 2. Safely wipe ONLY your local app migrations (ignoring the .venv)
find . -path "*/migrations/*.py" -not -path "*/.venv/*" -not -name "__init__.py" -delete
find . -path "*/migrations/*.pyc" -not -path "*/.venv/*" -delete

# 3. Create fresh migrations based on your current models
python manage.py makemigrations

# 4. Apply them to a brand new database!
python manage.py migrate
```

---

## 3. Common Errors

### `ModuleNotFoundError: No module named 'django.db.migrations.migration'`
**Cause**: You accidentally deleted Django's internal migration files inside your `.venv` directory (usually via a bad `find` or `rm` command).
**Fix**: Force-reinstall Django to repair the virtual environment.
```bash
pip install --force-reinstall django
```

### `InconsistentMigrationHistory: Migration admin.0001_initial is applied before its dependency users.0001_initial`
**Cause**: You changed the `AUTH_USER_MODEL` in `settings.py` after the database was already created.
**Fix**: Follow **The Nuclear Option** above to wipe the database and start fresh.

### `OperationalError: no such table`
**Cause**: You added a new model or changed a table name but haven't run migrations.
**Fix**: Simply run `python manage.py makemigrations` followed by `python manage.py migrate`.
