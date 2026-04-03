# Cloudflare Workers React Template

[![Deploy to Cloudflare][![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/NathanArgenti/Web-MessagingApp)]

A production-ready full-stack template for Cloudflare Workers featuring a React frontend with shadcn/ui, Tailwind CSS, Hono backend with Durable Objects, Tanstack Query, and TypeScript end-to-end.

## 🚀 Features

- **Full-Stack TypeScript**: Zero-config type-sharing between frontend and Worker backend.
- **Cloudflare Durable Objects**: Built-in global state management with counter and demo CRUD examples.
- **Modern React Stack**: Vite, React 18, React Router, Tanstack Query, Zustand, Framer Motion.
- **Beautiful UI**: shadcn/ui components, Tailwind CSS with custom New York theme, dark mode.
- **API Routes**: Hono-powered REST API with CORS, logging, and error handling (`/api/*`).
- **Demo Endpoints**:
  - `GET /api/demo` - Fetch demo items
  - `POST /api/demo` - Add item
  - `GET/PUT/DELETE /api/demo/:id` - CRUD operations
  - `GET /api/counter` - Get counter
  - `POST /api/counter/increment` - Increment counter
- **Error Handling**: Client/server error reporting, React Error Boundaries.
- **Development Workflow**: Hot reload, Bun-powered, Wrangler deployment.
- **Responsive Design**: Mobile-first, sidebar layout, animations.

## 🛠 Tech Stack

| Frontend | Backend | Tools |
|----------|---------|-------|
| React 18 | Hono | Cloudflare Workers |
| Vite | Durable Objects | Wrangler |
| TypeScript | SQLite (DO storage) | Bun |
| Tailwind CSS | | Tanstack Query |
| shadcn/ui | | React Router |
| Lucide Icons | | Framer Motion |
| Sonner (Toasts) | | Zod (Validation) |

## ⚡ Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (package manager)
- [Cloudflare CLI (Wrangler)](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Cloudflare account (free tier works)

### Installation

1. Clone or download the repository.
2. Install dependencies:

   ```bash
   bun install
   ```

3. Generate Worker types:

   ```bash
   bun run cf-typegen
   ```

### Development

Start the dev server (frontend + Worker proxy):

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). API routes available at `/api/*`.

### Build for Production

```bash
bun run build
```

Assets built to `dist/`, Worker to `worker/`.

### Deployment

1. Login to Cloudflare:

   ```bash
   wrangler login
   ```

2. Deploy:

   ```bash
   bun run deploy
   ```

   Or use the one-click deploy:

   [![Deploy to Cloudflare][![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/NathanArgenti/Web-MessagingApp)]

Durable Objects are auto-migrated. View logs/metrics in Cloudflare dashboard.

## 📚 Usage Examples

### Frontend Queries (Tanstack Query)

```tsx
// Example: Fetch demo items
const { data } = useQuery({
  queryKey: ['demo'],
  queryFn: () => api.get<DemoItem[]>('/api/demo').then(res => res.data),
});
```

### API Client

Shared types in `@shared/types`. Use `fetch` or Axios with `/api/*`.

### Custom Routes

Add routes in `worker/userRoutes.ts`. Restart dev server or redeploy.

### Durable Objects

Access via `env.GlobalDurableObject.get(idFromName('global'))`. Extend `GlobalDurableObject` class.

## 🤝 Contributing

1. Fork and clone.
2. Install deps: `bun install`.
3. Make changes.
4. Test locally: `bun run dev`.
5. PR to `main`.

Linting: `bun run lint`.

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.

## 🙌 Support

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/)