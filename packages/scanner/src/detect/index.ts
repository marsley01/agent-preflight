import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ProjectDetection } from "../types";

function safeReadJSON(path: string): any | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function hasFile(dir: string, ...paths: string[]): boolean {
  return existsSync(join(dir, ...paths));
}

export function detectProject(projectRoot: string): ProjectDetection {
  const pkg = safeReadJSON(join(projectRoot, "package.json"));
  const deps: Record<string, string> = {};
  const devDeps: Record<string, string> = {};

  if (pkg) {
    const d = pkg.dependencies || {};
    const dd = pkg.devDependencies || {};
    for (const [k, v] of Object.entries(d)) deps[k] = v as string;
    for (const [k, v] of Object.entries(dd)) devDeps[k] = v as string;
  }

  let frontend: string | undefined;
  if (deps.next) frontend = "Next.js";
  else if (deps.nuxt || deps["nuxt3"]) frontend = "Nuxt";
  else if (deps.react) frontend = "React";
  else if (deps.vue) frontend = "Vue";
  else if (deps.svelte) frontend = "Svelte";
  else if (deps.angular) frontend = "Angular";
  else if (deps.astro) frontend = "Astro";
  else if (deps.remix || deps["@remix-run/react"]) frontend = "Remix";
  else if (deps.gatsby) frontend = "Gatsby";
  else if (deps["@sveltejs/kit"]) frontend = "SvelteKit";

  let backend: string | undefined;
  if (deps.express) backend = "Express";
  else if (deps.fastify) backend = "Fastify";
  else if (deps.nest) backend = "NestJS";
  else if (deps.koa) backend = "Koa";
  else if (deps.hono) backend = "Hono";
  else if (deps["@hono/hono"]) backend = "Hono";
  else if (deps.elysia) backend = "Elysia";
  else if (deps.trpc || deps["@trpc/server"]) backend = "tRPC";
  else if (hasFile(projectRoot, "manage.py")) backend = "Django";
  else if (hasFile(projectRoot, "Gemfile")) backend = "Rails";
  else if (hasFile(projectRoot, "Cargo.toml")) backend = "Axum";
  else if (deps["@supabase/supabase-js"]) backend = "Supabase";
  else if (deps.firebase || deps["firebase-admin"]) backend = "Firebase";

  let pm: string | undefined;
  if (hasFile(projectRoot, "pnpm-lock.yaml")) pm = "pnpm";
  else if (hasFile(projectRoot, "yarn.lock")) pm = "yarn";
  else if (hasFile(projectRoot, "package-lock.json")) pm = "npm";
  else if (hasFile(projectRoot, "bun.lock") || hasFile(projectRoot, "bun.lockb")) pm = "bun";

  let db: string | undefined;
  if (deps.prisma && deps["@prisma/client"]) db = "PostgreSQL (via Prisma)";
  else if (deps.mongoose) db = "MongoDB";
  else if (deps["@supabase/supabase-js"]) db = "PostgreSQL (via Supabase)";
  else if (deps.redis || deps.ioredis) db = "Redis";
  else if (deps.typeorm) db = "TypeORM (multi)";
  else if (deps.drizzle || deps["drizzle-orm"]) db = "Drizzle (multi)";
  else if (deps.firebase || deps["firebase-admin"]) db = "Firestore";
  else if (deps.sqlite3 || deps["better-sqlite3"]) db = "SQLite";
  else if (deps.mysql || deps["mysql2"]) db = "MySQL";

  let orm: string | undefined;
  if (deps.prisma) orm = "Prisma";
  else if (deps.drizzle || deps["drizzle-orm"]) orm = "Drizzle";
  else if (deps.typeorm) orm = "TypeORM";
  else if (deps.mongoose) orm = "Mongoose";
  else if (deps.knex) orm = "Knex";
  else if (deps.sequelize) orm = "Sequelize";

  let cloud: string | undefined;
  if (deps.vercel || deps["@vercel/node"]) cloud = "Vercel";
  else if (deps["@aws-sdk/client-lambda"] || deps["aws-sdk"]) cloud = "AWS";
  else if (deps["@google-cloud/functions-framework"]) cloud = "Google Cloud";
  else if (deps["@azure/functions"]) cloud = "Azure";
  else if (deps.cloudflare || deps["@cloudflare/workers-types"]) cloud = "Cloudflare";
  else if (deps.netlify || deps["@netlify/functions"]) cloud = "Netlify";
  else if (deps.railway) cloud = "Railway";

  const deployTarget = cloud || (hasFile(projectRoot, "Dockerfile") ? "Docker" : undefined);

  let ci: string | undefined;
  if (hasFile(projectRoot, ".github", "workflows")) ci = "GitHub Actions";
  else if (hasFile(projectRoot, ".gitlab-ci.yml")) ci = "GitLab CI";
  else if (hasFile(projectRoot, "Jenkinsfile")) ci = "Jenkins";
  else if (hasFile(projectRoot, "circle.yml") || hasFile(projectRoot, ".circleci")) ci = "CircleCI";
  else if (hasFile(projectRoot, ".woodpecker.yml")) ci = "Woodpecker";

  let aiFramework: string | undefined;
  if (deps.crewai || deps["crewai-tools"]) aiFramework = "CrewAI";
  else if (deps["@langchain/core"] || deps.langchain) aiFramework = "LangChain";
  else if (deps["@langchain/langgraph"]) aiFramework = "LangGraph";
  else if (deps.autogen || deps["pyautogen"]) aiFramework = "AutoGen";
  else if (deps["openai"]) aiFramework = "OpenAI SDK";
  else if (deps["@ai-sdk/core"] || deps["ai"]) aiFramework = "Vercel AI SDK";
  else if (deps["mastra"]) aiFramework = "Mastra";
  else if (deps["llamaindex"]) aiFramework = "LlamaIndex";
  else if (deps["@anthropic-ai/sdk"]) aiFramework = "Anthropic SDK";

  let container: string | undefined;
  if (hasFile(projectRoot, "Dockerfile")) container = "Docker";
  else if (hasFile(projectRoot, "docker-compose.yml") || hasFile(projectRoot, "docker-compose.yaml")) container = "Docker Compose";

  let auth: string | undefined;
  if (deps.next && deps["next-auth"] || deps["@auth/core"]) auth = "NextAuth";
  else if (deps.clerk || deps["@clerk/nextjs"]) auth = "Clerk";
  else if (deps["@supabase/supabase-js"]) auth = "Supabase Auth";
  else if (deps.firebase || deps["firebase-admin"]) auth = "Firebase Auth";
  else if (deps.auth0 || deps["@auth0/nextjs"]) auth = "Auth0";
  else if (deps.passport) auth = "Passport";

  let lang = "JavaScript";
  if (hasFile(projectRoot, "tsconfig.json")) lang = "TypeScript";
  else if (hasFile(projectRoot, "pyproject.toml") || hasFile(projectRoot, "requirements.txt")) lang = "Python";
  else if (hasFile(projectRoot, "Cargo.toml")) lang = "Rust";
  else if (hasFile(projectRoot, "go.mod")) lang = "Go";
  else if (hasFile(projectRoot, "Gemfile")) lang = "Ruby";
  else if (hasFile(projectRoot, "pom.xml") || hasFile(projectRoot, "build.gradle")) lang = "Java";
  else if (hasFile(projectRoot, "composer.json")) lang = "PHP";
  else if (hasFile(projectRoot, "Package.swift")) lang = "Swift";

  const name = pkg?.name || projectRoot.split(/[/\\]/).pop() || "unknown";

  return {
    name,
    language: lang,
    frontend,
    backend,
    packageManager: pm,
    database: db,
    orm,
    cloudProvider: cloud,
    deploymentTarget: deployTarget,
    ciPlatform: ci,
    aiFramework,
    containerRuntime: container,
    authProvider: auth,
    dependencies: deps,
    devDependencies: devDeps,
    projectRoot,
  };
}