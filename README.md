# Permaculture Planner - Raised Bed Garden Design App

A Next.js application that generates permaculture plans for raised-bed gardens on any surface (soil, gravel, concrete, or rooftops). Based on research-backed horticulture principles from agricultural extension services.

## Features

### ✅ Implemented (v1)
- **Smart Layout Generation**: Optimized bed placement based on space, sun exposure, and accessibility
- **Materials Calculator**: Complete bill of materials with cost estimates
- **Crop Rotation Engine**: Science-based 3-season rotation preventing disease and maximizing yields
- **Plan Builder Wizard**: Step-by-step guidance through site assessment
- **Irrigation Planning**: Drip system layouts and wicking bed designs
- **Task Scheduling**: Monthly garden tasks and planting calendar
- **Multiple Surface Support**: Works on soil, concrete, patios, and rooftops
- **Horticulture Rules Engine**: Based on extension service research

### 🚧 In Progress
- AI copilot for personalized advice
- PDF export and sharing

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (`DATABASE_URL`)
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)

## Getting Started

### Prerequisites

- Node.js 20.9+
- npm or yarn
- PostgreSQL 14+

### Installation

1. Clone the repository:
```bash
git clone https://github.com/decoge/permaculture-planner.git
cd permaculture-planner
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with a Postgres connection string and a session secret:
```
DATABASE_URL=postgres://planner:planner@localhost:5432/permaculture
SESSION_SECRET=replace-with-a-long-random-string
```

4. Set up the database:

```bash
npm run db:migrate
```

Accounts are email and password, stored in Postgres. Set `ADMIN_EMAIL` before signup, or run `npm run db:make-admin -- you@example.com` and sign in again.

5. Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

```
permaculture-planner/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes
│   ├── wizard/            # Plan builder wizard
│   └── plans/             # Plan display pages
├── components/            # React components
│   ├── ui/                # Reusable UI components
│   ├── wizard/            # Wizard step components
│   └── editor/            # Layout editor components
├── lib/                   # Core logic
│   ├── algorithms/        # Layout, materials, rotation engines
│   ├── data/              # Crop database and horticulture rules
│   ├── db/                # Postgres pool and queries
│   └── utils/             # Utility functions
└── types/                 # TypeScript type definitions
```

## Core Algorithms

### Layout Generator
Generates optimal raised bed layouts based on:
- Available space and shape
- Sun exposure requirements (6+ hours for most vegetables)
- North-south orientation for even lighting
- Accessibility needs (3ft vs 4ft bed widths)
- Path widths (18-36 inches)

### Materials Calculator
Calculates exact quantities for:
- Soil mix (cu ft/yards)
- Compost and amendments
- Lumber (optimized cut list)
- Hardware and irrigation supplies
- Row covers and support structures

### Crop Rotation Engine
Implements science-based rotation:
- Prevents same-family plantings for 2-3 years
- Matches crops to sun exposure
- Succession planting for continuous harvest
- Companion planting recommendations

## Horticulture Rules

The app implements research-backed guidelines from:
- USDA hardiness zones and frost dates
- Extension service recommendations for bed dimensions
- IPM (Integrated Pest Management) principles
- Water-efficient irrigation methods
- Soil building techniques (sheet mulching)

## Database Schema

Key tables:
- `sites`: User garden locations and constraints
- `plans`: Generated garden plans
- `beds`: Individual raised beds with dimensions
- `plantings`: Crop assignments by season
- `materials_estimates`: Shopping lists and costs
- `tasks`: Scheduled garden activities

## API Endpoints

- `POST /api/plans` - Generate a new plan from wizard data
- `GET /api/plans/:id` - Retrieve plan details
- `PATCH /api/plans/:id` - Update plan
- `POST /api/plans/:id/ai` - AI copilot queries

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Future Roadmap

- [ ] 3D visualization of garden layout
- [ ] Mobile app for task tracking
- [ ] Community plan sharing
- [ ] Local seed supplier integration
- [ ] Weather-based task reminders
- [ ] Harvest tracking and yield reports
- [ ] Perennial and orchard planning
- [ ] Companion planting optimizer

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Extension service publications for horticulture guidelines
- Square Foot Gardening methodology
- Permaculture design principles
- shadcn/ui for component library

## Support

For questions or issues, please open a GitHub issue or contact [your-email@example.com]// Deployment trigger 1759143298
