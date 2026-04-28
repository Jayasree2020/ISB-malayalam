const { ensureSchema, getSql } = require("./db");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.status(405).send("Method not allowed");
    return;
  }

  try {
    const sql = await getSql();
    await ensureSchema(sql);
    const projects = await sql`
      SELECT
        id,
        project_title AS "projectTitle",
        section_ref AS "sectionRef",
        editor_name AS "editorName",
        updated_at AS "updatedAt"
      FROM translation_projects
      ORDER BY updated_at DESC
      LIMIT 100
    `;

    response.status(200).json({ projects });
  } catch (error) {
    response.status(500).send(error.message);
  }
};
