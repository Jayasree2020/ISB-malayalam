module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).send("Method not allowed");
    return;
  }

  try {
    const { fileBase64 } = request.body || {};
    if (!fileBase64) {
      response.status(400).send("fileBase64 is required.");
      return;
    }

    const WordExtractor = require("word-extractor");
    const extractor = new WordExtractor();
    const buffer = Buffer.from(fileBase64, "base64");
    const document = await extractor.extract(buffer);
    const sections = [
      document.getHeaders?.({ includeFooters: false }) || "",
      document.getBody?.() || "",
      document.getTextboxes?.({ includeHeadersAndFooters: true, includeBody: true }) || "",
      document.getFooters?.() || "",
      document.getEndnotes?.() || "",
      document.getFootnotes?.() || ""
    ].filter((text) => text && text.trim());

    response.status(200).json({
      text: sections.join("\n\n").replace(/\n{4,}/g, "\n\n\n").trim()
    });
  } catch (error) {
    response.status(500).send(error.message || "Could not extract the Word document.");
  }
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb"
    }
  }
};
