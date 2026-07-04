# syntax=docker/dockerfile:1

# Packages a pre-built Next.js app. Run `npm run build` locally first —
# this image only copies the standalone output, it does not build.
FROM gdssingapore/airbase:node-22 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as an unprivileged user.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Copy the pre-built standalone server, static assets, and public files.
COPY public ./public
COPY --chown=nextjs:nodejs .next/standalone ./
COPY --chown=nextjs:nodejs .next/static ./.next/static

USER nextjs
EXPOSE 3000

# standalone build emits server.js at the app root.
CMD ["node", "server.js"]
