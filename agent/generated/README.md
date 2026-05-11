# 🚀 Space Fractions

A web-based interactive fraction-learning game for sixth-grade students. Master fractions while exploring the galaxy!

## Features

- **Interactive Gameplay**: Answer fraction questions in a space-themed environment
- **Multiple Difficulty Levels**: Easy, medium, and hard questions
- **Live Score Tracking**: See your score and progress in real-time
- **Animated Starfield**: Immersive cosmic visual experience
- **Authentication**: Register and login to track your progress
- **Admin Panel**: Manage questions (CRUD operations)
- **Pause/Resume**: Take a break and come back later

## Tech Stack

- **Runtime**: Node.js 18
- **Framework**: Express.js 4
- **Database**: PostgreSQL 14
- **Cache**: Redis 6
- **Auth**: JWT (JSON Web Tokens)
- **Frontend**: Vanilla HTML/CSS/JS (no build step required)

## Project Structure

```
space-fractions/
├── public/
│   └── index.html          # Single-file game UI
├── sql/
│   └── init.sql            # Database schema + seed data
├── src/
│   ├── app.js              # Express app setup
│   ├── server.js           # Server entry point
│   ├── db.js               # PostgreSQL connection pool
│   ├── game/
│   │   ├── gameService.js  # Game logic (start, answer, score, pause, resume)
│   │   └── gameRoutes.js   # Game API routes
│   ├── question/
│   │   ├── questionService.js  # Question CRUD + validation
│   │   └── questionRoutes.js   # Question API routes
│   └── user/
│       ├── userService.js      # Auth (register, login, JWT)
│       ├── authMiddleware.js   # Auth middleware (requireAuth, requireAdmin)
│       └── userRoutes.js       # User API routes
├── tests/
│   ├── game.test.js        # Game API tests
│   └── question.test.js    # Question API tests
├── k8s/
│   └── deployment.yaml     # Kubernetes deployment manifests
├── docker-compose.yml      # Docker Compose (app + postgres + redis)
├── Dockerfile              # Docker image
├── openapi.yaml            # API specification
├── package.json
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+ (optional, for caching)

### 1. Clone and Install

```bash
git clone <repo-url>
cd space-fractions
npm install
```

### 2. Setup Database

```bash
# Create the database
createdb spacefractions

# Run the init script
psql -U your_user -d spacefractions -f sql/init.sql
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your database credentials and a secure JWT secret
```

### 4. Start the Server

```bash
npm start
```

Visit **http://localhost:3000** to play the game!

### Using Docker Compose

```bash
docker-compose up --build
```

This will start the app, PostgreSQL, and Redis containers.

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/users/register` | No | Register a new user |
| POST | `/api/users/login` | No | Login |
| GET | `/api/users/me` | Yes | Get current user profile |
| POST | `/api/game/start` | Yes | Start a new game |
| POST | `/api/game/:id/answer` | Yes | Submit an answer |
| GET | `/api/game/:id/score` | Yes | Get current score |
| POST | `/api/game/:id/pause` | Yes | Pause the game |
| POST | `/api/game/:id/resume` | Yes | Resume the game |
| GET | `/api/questions` | Admin | List all questions |
| GET | `/api/questions/:id` | Admin | Get a question |
| POST | `/api/questions` | Admin | Create a question |
| PUT | `/api/questions/:id` | Admin | Update a question |
| DELETE | `/api/questions/:id` | Admin | Delete a question |
| GET | `/api/health` | No | Health check |

## Running Tests

```bash
npm test
```

Tests use Jest and Supertest. Make sure the database is running and seeded.

## Admin Access

Default admin credentials (after running `sql/init.sql`):
- Username: `admin`
- Password: `admin123`

## Kubernetes Deployment

```bash
kubectl apply -f k8s/deployment.yaml
```

This deploys the app, PostgreSQL, and Redis to your Kubernetes cluster.

## Game Flow

1. **Intro Screen** — See the animated starfield and rocket
2. **Login/Register** — Create an account or login
3. **Game Start** — 10 random fraction questions
4. **Answer Questions** — Multiple choice with instant feedback
5. **Score Display** — Live HUD showing score and progress
6. **Ending Celebration** — Final score, grade, and encouraging message

## License

MIT
