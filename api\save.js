const { ensureSchema, getSql, projectIdFrom } = require("./db");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).send("Method not allowed");
    return;
  }

  try {
    const body = request.body || {};
    const sql = await getSql();
    await ensureSchema(sql);

    const id = projectIdFrom(body);
    const projectTitle = body.projectTitle || "Malayalam Translation Project";
    const sectionRef = body.sectionRef || "";
    const editorName = body.editorName || "";
    const data = JSON.stringify(body);

    await sql`
      INSERT INTO translation_projects (id, project_title, section_ref, editor_name, data)
      VALUES (${id}, ${projectTitle}, ${sectionRef}, ${editorName}, ${data}::jsonb)
      ON CONFLICT (id)
      DO UPDATE SET
        project_title = EXCLUDED.project_title,
        section_ref = EXCLUDED.section_ref,
        editor_name = EXCLUDED.editor_name,
        data = EXCLUDED.data,
        updated_at = NOW()
    `;

    response.status(200).json({ ok: true, id });
  } catch (error) {
    response.status(500).send(error.message);
  }
};
