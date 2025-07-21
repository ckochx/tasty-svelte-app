# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Getting setup:

1. Start the database:
npm run db:start
2. Set environment variable:
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tasty-app"
2. Or add it to your .env file:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tasty-app
3. Push the schema:
npm run db:push
4. Optional: Open Drizzle Studio (database GUI):
npm run db:studio

Key Points:

- The project uses Drizzle ORM with PostgreSQL
- Docker Compose provides the database (user: postgres, password: postgres, db: tasty-app)
- Schema defines user and session tables for authentication
- db:push is fastest for development, db:migrate is better for production

Quick start: npm run db:start then npm run db:push should get you running! 🚀

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
