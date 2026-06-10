/// <reference types="astro/client" />

// Cloudflare bindings, aliased via inline imports so the workers-types
// package doesn't override DOM globals (Element, Response, ...) used by
// client-side scripts.
type D1Database = import("@cloudflare/workers-types").D1Database;
type D1PreparedStatement = import("@cloudflare/workers-types").D1PreparedStatement;
type KVNamespace = import("@cloudflare/workers-types").KVNamespace;

type Env = {
  DB: D1Database;
  SESSION: KVNamespace;
};

declare module "cloudflare:workers" {
  export const env: Env;
}

declare namespace App {
  interface Locals extends import("@astrojs/cloudflare").Runtime {}
}
