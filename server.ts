import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import { createAdminRouter } from './server/createAdminRouter.ts';
import { createTeacherRouter } from './server/createTeacherRouter.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Backend API routes MUST be registered before Vite / SPA static fallback
  app.use('/api/admin', createAdminRouter());
  app.use('/api/teacher', createTeacherRouter());

  // Fallback JSON 404 for unknown /api/* routes
  app.use('/api', (_req, res) => {
    res.status(404).json({
      ok: false,
      code: 'NOT_FOUND',
      message: 'Endpoint API không tồn tại.'
    });
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    const lessonsDir = path.join(__dirname, 'public', 'lessons');

    if (fs.existsSync(lessonsDir)) {
      app.use('/lessons', express.static(lessonsDir));
    }
    app.use('/lessons', (_req, res) => {
      res.status(404).type('text/plain; charset=utf-8').send('Bài học đang được cập nhật (404 Not Found)');
    });

    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Tây Đô Smart EDU server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start Tây Đô Smart EDU server:', err);
  process.exit(1);
});
