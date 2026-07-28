# Projects

Each project in this directory should be self-contained.

Recommended structure:

```text
projects/
└── project-name/
    ├── README.md
    ├── src/
    ├── tests/
    ├── .env.example
    └── package.json or pyproject.toml
```

## Rules

1. Use a short lowercase folder name with hyphens.
2. Add a README with purpose, setup, configuration, and deployment instructions.
3. Never commit real API keys, tokens, passwords, or private user data.
4. Add an `.env.example` file when configuration is required.
5. Keep generated files and dependencies out of Git.

## Planned projects

- `steam-status-tracker` — Steam profile activity monitor with history and notifications.
