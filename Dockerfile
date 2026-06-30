FROM mcr.microsoft.com/playwright:v1.61.1-noble AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

FROM mcr.microsoft.com/playwright:v1.61.1-noble AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.61.1-noble AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/app ./app
COPY --from=builder /app/data ./data
COPY --from=builder /app/extension ./extension
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/prompts ./prompts
COPY --from=builder /app/AI_Engineer.pdf ./AI_Engineer.pdf
COPY --from=builder /app/Forward_Deployed_Engineer.pdf ./Forward_Deployed_Engineer.pdf
COPY --from=builder ["/app/Full Stack Software Engineer.pdf", "./Full Stack Software Engineer.pdf"]
COPY --from=builder /app/Software_Engineer.pdf ./Software_Engineer.pdf
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "start"]
