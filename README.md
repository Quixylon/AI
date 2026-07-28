# Quixylon AI Lab

A public collection of AI-powered projects, automation tools, experiments, and software developed by Quixylon.

## About

This repository is the central workspace for projects built with artificial intelligence and modern web technologies. Each finished project will have its own folder, documentation, setup instructions, and configuration example.

## Projects

| Project | Description | Status |
| --- | --- | --- |
| [Steam Status Tracker](projects/steam-status-tracker) | A web application for checking a public Steam profile, current game, online status, and recent activity. | In development |

## Repository structure

```text
AI/
├── projects/        # Independent applications and experiments
├── docs/            # Plans, architecture notes, and documentation
├── .gitignore       # Files that must never be committed
└── README.md        # Repository overview
```

## Security

API keys, passwords, tokens, database credentials, and `.env` files must never be committed to this repository. Public example configuration files should use names such as `.env.example` and contain placeholders only.

## Development principles

- Every project should be understandable and runnable from its own README.
- Secrets are stored only in environment variables.
- Changes should be small, documented, and easy to review.
- Working applications are preferred over unfinished code dumps.

## Current goal

Complete and deploy **Steam Status Tracker**, then add persistent activity history and notifications.

---

Created and maintained by **Quixylon**.