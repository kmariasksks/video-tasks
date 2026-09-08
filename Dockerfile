# ============================================
# STAGE 1: builder — installs deps, builds Next.js
# ============================================
FROM node:22-alpine AS builder

WORKDIR /app

# Alpine базовий образ — мінімальний Linux (~5MB).
# libc6-compat потрібен для деяких Node.js бібліотек (dnd-kit тощо).
RUN apk add --no-cache libc6-compat

# Спочатку копіюємо тільки package files — це дозволяє Docker
# закешувати шар з npm install, поки залежності не змінились.
COPY package.json package-lock.json* ./
RUN npm ci

# Тепер копіюємо весь код і білдимо
COPY . .

# Next.js потрібні змінні середовища на етапі build
# (для NEXT_PUBLIC_* префіксу — вони запікаються в бандл).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build

# ============================================
# STAGE 2: runner — minimal production image
# ============================================
FROM node:22-alpine AS runner

WORKDIR /app

# FFmpeg — наша ключова залежність для відео-пайплайну.
# Ставиться зараз, щоб точно був у продакшн-образі.
RUN apk add --no-cache ffmpeg libc6-compat

# Створюємо непривілейованого користувача (best practice для безпеки:
# не запускати процес під root у продакшні).
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Копіюємо тільки необхідні артефакти зі стадії builder.
# .next/standalone — це "standalone output" Next.js:
# самодостатня папка зі всім потрібним для запуску.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production

CMD ["node", "server.js"]