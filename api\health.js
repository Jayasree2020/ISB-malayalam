module.exports = async function handler(request, response) {
  response.status(200).json({
    ok: true,
    service: "ISB Malayalam Translation Workbench",
    timestamp: new Date().toISOString(),
    storageConfigured: Boolean(process.env.DATABASE_URL),
    translateConfigured: Boolean(process.env.GOOGLE_TRANSLATE_PROJECT_ID)
  });
};
