# SoulTrader

A peer-to-peer item trading platform for FromSoftware's SoulsBorne game series. SoulTrader enables players to create, browse, and complete item trades across Dark Souls, Dark Souls 2, Dark Souls 3, Bloodborne, Elden Ring, and Demon's Souls.

## Features

- **Multi-Game Trading** — Browse and create trade offers for items across six FromSoftware titles
- **User Authentication** — Email-based registration with verification, JWT session management
- **Trade Workflow** — Full lifecycle: create offers, accept, confirm, and rate trade partners
- **Reputation System** — Karma-based scoring derived from post-trade ratings (1–10 scale)
- **Email Notifications** — Automated emails for account verification, trade acceptance, and confirmation
- **Platform Filtering** — Filter trades by PlayStation, Xbox, or PC
- **Role-Based Access** — User, moderator, and admin roles with distinct privileges

## Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Backend    | Node.js, Express.js               |
| Database   | PostgreSQL, Sequelize ORM          |
| Frontend   | EJS templates, vanilla JS, CSS     |
| Auth       | JWT (httpOnly cookies), bcrypt     |
| Email      | Nodemailer (SMTP/SSL)             |

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL (v14+)

### Installation

```bash
git clone <repo-url>
cd SoulTrader
npm install
```

### Configuration

Create a `.env` file in the project root:

```env
POSTGRES_DB=soultrader
POSTGRES_USER=your_db_user
POSTGRES_PASSWORD=your_db_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
JWT_SECRET=your_jwt_secret
PORT=5000
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_email_password
```

### Database Setup

```bash
npx sequelize-cli db:migrate
```

### Seed Item Data

```bash
node scripts/seedItems.js data/darksouls-weapons.txt
node scripts/seedItems.js data/darksouls-armor.txt
node scripts/seedItems.js data/darksouls-items.txt
node scripts/seedItems.js data/darksouls-souls.txt
node scripts/seedItems.js data/darksouls-upgrades.txt
```

### Run

```bash
npm start
```

The server starts on `http://localhost:5000`.

## Project Structure

```
SoulTrader/
├── config/          # Database configuration
├── controllers/     # Route handlers (auth, game pages)
├── data/            # Item seed data files
├── middleware/       # Auth and role-check middleware
├── migrations/      # Sequelize schema migrations
├── models/          # Sequelize models (User, Item, Trade)
├── routes/          # Express route definitions
├── scripts/         # Utility scripts (item seeding)
├── utils/           # Email service, auth helpers
├── views/           # EJS templates (pages and modals)
├── server.js        # Application entry point
└── package.json
```

## Trade Workflow

1. **Create** — User lists items they offer and request, selects platform
2. **Accept** — Another user accepts the offer, providing contact details
3. **Confirm** — Original creator confirms the trade after in-game completion
4. **Rate** — Both parties rate each other (1–10), affecting karma scores

## License

All rights reserved.
