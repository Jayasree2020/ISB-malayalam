module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).send("Method not allowed");
    return;
  }

  try {
    const { text, target = "ml" } = request.body || {};
    if (!text) {
      response.status(400).send("Text is required.");
      return;
    }

    if (!process.env.GOOGLE_TRANSLATE_PROJECT_ID) {
      response.status(501).send("Google Translate is not configured.");
      return;
    }

    const { TranslationServiceClient } = require("@google-cloud/translate").v3;
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
      ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
      : undefined;
    const client = new TranslationServiceClient({ credentials });
    const projectId = process.env.GOOGLE_TRANSLATE_PROJECT_ID;
    const location = "global";

    const [result] = await client.translateText({
      parent: `projects/${projectId}/locations/${location}`,
      contents: [text],
      mimeType: "text/plain",
      sourceLanguageCode: "en",
      targetLanguageCode: target
    });

    response.status(200).json({
      translation: result.translations?.[0]?.translatedText || ""
    });
  } catch (error) {
    response.status(500).send(error.message);
  }
};
