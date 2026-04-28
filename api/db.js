let sqlClient;

async function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!sqlClient) {
    const { neon } = await import("@neondatabase/serverless");
    sqlClient = neon(process.env.DATABASE_URL);
  }

  return sqlClient;
}

async function ensureSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS translation_projects (
      id TEXT PRIMARY KEY,
      project_title TEXT NOT NULL,
      section_ref TEXT,
      editor_name TEXT,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

function projectIdFrom(body) {
  const title = body.projectTitle || "Malayalam Translation Project";
  const section = body.sectionRef || "main";
  return `${title}::${section}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

module.exports = { ensureSchema, getSql, projectIdFrom };
