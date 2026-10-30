const http = require("node:http");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const rootDirectory = __dirname;
const dataDirectory = path.join(rootDirectory, "data");
const notesFile = path.join(dataDirectory, "notes.json");
const port = Number(process.env.PORT) || 3000;
const host = "127.0.0.1";
const maximumRequestSize = 10_000;
let writes = Promise.resolve();

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
};

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}

async function readNotes() {
  const contents = await fs.readFile(notesFile, "utf8");
  const notes = JSON.parse(contents);

  if (!Array.isArray(notes)) {
    throw new Error("The notes JSON file must contain an array.");
  }

  return notes;
}

function updateNotes(update) {
  const write = writes.then(async () => {
    const updatedNotes = await update(await readNotes());
    if (updatedNotes === null) {
      return null;
    }

    await fs.writeFile(notesFile, `${JSON.stringify(updatedNotes, null, 2)}\n`);
    return updatedNotes;
  });
  writes = write.then(
    () => undefined,
    () => undefined,
  );
  return write;
}

async function readRequestBody(request) {
  const chunks = [];
  let totalSize = 0;

  for await (const chunk of request) {
    totalSize += chunk.length;
    if (totalSize > maximumRequestSize) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

async function handleNotes(request, response, noteId) {
  if (request.method === "GET") {
    if (noteId) {
      sendJson(response, 404, { error: "The requested note was not found." });
      return;
    }
    sendJson(response, 200, await readNotes());
    return;
  }

  if (request.method === "DELETE" && noteId) {
    const notes = await updateNotes((currentNotes) => {
      const updatedNotes = currentNotes.filter((note) => note.id !== noteId);
      return updatedNotes.length === currentNotes.length ? null : updatedNotes;
    });

    if (notes === null) {
      sendJson(response, 404, { error: "The requested note was not found." });
      return;
    }

    sendJson(response, 200, notes);
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use GET, POST, or DELETE for notes." });
    return;
  }

  if (noteId) {
    sendJson(response, 404, { error: "The requested note was not found." });
    return;
  }

  if (!request.headers["content-type"]?.includes("application/json")) {
    sendJson(response, 415, { error: "Send notes as application/json." });
    return;
  }

  const body = await readRequestBody(request);
  const title =
    body && typeof body.title === "string" ? body.title.trim() : "";
  const text = body && typeof body.text === "string" ? body.text.trim() : "";

  if (!title || !text || title.length > 80 || text.length > 500) {
    sendJson(response, 400, {
      error: "Provide a title (up to 80 characters) and text (up to 500 characters).",
    });
    return;
  }

  const note = {
    id: randomUUID(),
    title,
    text,
    createdAt: new Date().toISOString(),
  };
  const notes = await updateNotes((currentNotes) => [...currentNotes, note]);
  sendJson(response, 201, notes);
}

async function serveStaticFile(request, response, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method not allowed.");
    return;
  }

  if (pathname === "/data" || pathname.startsWith("/data/")) {
    response.writeHead(404);
    response.end("Not found.");
    return;
  }

  const relativePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(rootDirectory, `.${relativePath}`);
  if (!filePath.startsWith(`${rootDirectory}${path.sep}`)) {
    response.writeHead(404);
    response.end("Not found.");
    return;
  }

  let contents;
  try {
    contents = await fs.readFile(filePath);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      response.writeHead(404);
      response.end("Not found.");
      return;
    }
    throw error;
  }

  response.writeHead(200, {
    "Content-Type":
      mimeTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
    "Content-Length": contents.length,
    "X-Content-Type-Options": "nosniff",
  });
  response.end(request.method === "HEAD" ? undefined : contents);
}

async function initialize() {
  await fs.mkdir(dataDirectory, { recursive: true });

  try {
    await fs.writeFile(notesFile, "[]\n", { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }

  await readNotes();
}

async function startServer() {
  await initialize();

  const server = http.createServer((request, response) => {
    void (async () => {
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(request.url, `http://${host}`).pathname);
      } catch {
        response.writeHead(400);
        response.end("Invalid URL.");
        return;
      }

      try {
        const noteRoute = pathname.match(/^\/api\/notes(?:\/([^/]+))?$/);
        if (noteRoute) {
          await handleNotes(request, response, noteRoute[1]);
          return;
        }

        await serveStaticFile(request, response, pathname);
      } catch (error) {
        console.error("Request failed:", error);
        if (!response.headersSent) {
          sendJson(response, error.statusCode ?? 500, {
            error:
              error.statusCode === 400 || error.statusCode === 413
                ? error.message
                : "The request could not be completed.",
          });
        } else {
          response.destroy(error);
        }
      }
    })();
  });

  server.listen(port, host, () => {
    console.log(`HTML Lessons is running at http://${host}:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Could not start the local server:", error);
  process.exitCode = 1;
});
