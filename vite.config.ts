import fs from 'fs';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig, Plugin} from 'vite';

function syncAvailableLessons() {
  try {
    const lessonsDir = path.join(process.cwd(), 'public', 'lessons');
    const urls: string[] = [];
    function scan(dir: string) {
      if (!fs.existsSync(dir)) return;
      for (const file of fs.readdirSync(dir)) {
        const full = path.join(dir, file);
        if (fs.statSync(full).isDirectory()) {
          scan(full);
        } else if (file === 'index.html' || file.endsWith('.html')) {
          const rel = path.relative(path.join(process.cwd(), 'public'), full).replace(/\\/g, '/');
          urls.push('/' + rel);
        }
      }
    }
    scan(lessonsDir);
    const target = path.join(process.cwd(), 'src', 'data', 'availableLessonPaths.json');
    fs.writeFileSync(target, JSON.stringify(urls, null, 2));
  } catch (_) {}
}

function serveLessonsPlugin(): Plugin {
  return {
    name: 'serve-lessons-static',
    buildStart() {
      syncAvailableLessons();
    },
    configureServer(server) {
      syncAvailableLessons();
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url ? req.url.split('?')[0] : '';
        if (rawUrl.startsWith('/lessons/')) {
          const filePath = path.join(process.cwd(), 'public', decodeURIComponent(rawUrl));
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes: Record<string, string> = {
              '.html': 'text/html; charset=utf-8',
              '.css': 'text/css; charset=utf-8',
              '.js': 'application/javascript; charset=utf-8',
              '.json': 'application/json; charset=utf-8',
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.gif': 'image/gif',
              '.svg': 'image/svg+xml',
              '.mp3': 'audio/mpeg',
              '.mp4': 'video/mp4',
            };
            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
            return fs.createReadStream(filePath).pipe(res);
          } else {
            // Ngăn chặn Vite fallback middleware biến yêu cầu học liệu thiếu thành trang chủ SPA
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            return res.end('Bài học đang được cập nhật (404 Not Found)');
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [serveLessonsPlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
