import { readFile, writeFile } from 'fs/promises';
import { createServer } from 'http';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3002;
const DATA_FILE = path.join(__dirname, "data", "links.json");

// Serve static files from the 'public' folder
const serveStaticFile = async (res, filePath) => {
    try {
        const ext = path.extname(filePath);
        const contentType = {
            ".html": "text/html",
            ".css": "text/css",
            ".js": "application/javascript",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".ico": "image/x-icon",
        }[ext] || "text/plain";

        const fullPath = path.join(__dirname, "public", filePath);

        if (fs.existsSync(fullPath)) {
            const data = await readFile(fullPath);
            res.writeHead(200, { "Content-Type": contentType });
            res.end(data);
        } else {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("404 Not Found");
        }
    } catch (error) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
    }
};

// Load links from JSON file
const loadLinks = async () => {
    try {
        const data = await readFile(DATA_FILE, 'utf-8');
        return data ? JSON.parse(data) : {};
    } catch (error) {
        if (error.code === "ENOENT") {
            await writeFile(DATA_FILE, JSON.stringify({}));
            return {};
        }
        throw error;
    }
};

// Save links to JSON file
const saveLinks = async (links) => {
    await writeFile(DATA_FILE, JSON.stringify(links, null, 2));
};

// Create HTTP server
const server = createServer(async (req, res) => {
    const urlPath = req.url.split("?")[0]; // Ignore query parameters

    if (req.method === "GET") {
        // Serve the main HTML page
        if (urlPath === "/") {
            return serveStaticFile(res, "index.html");
        } 

        // Serve static files from the 'public' folder
        const staticFileExtensions = [".css", ".js", ".png", ".jpg", ".ico"];
        if (staticFileExtensions.some(ext => urlPath.endsWith(ext))) {
            return serveStaticFile(res, urlPath.substring(1)); // Remove leading '/'
        }

        // Handle redirection for shortened URLs
        const links = await loadLinks();
        const shortCode = urlPath.substring(1);

        if (links[shortCode]) {
            res.writeHead(302, { Location: links[shortCode] });
            return res.end();
        }

        // If not found, return 404
        res.writeHead(404, { "Content-Type": "text/plain" });
        return res.end("404 Not Found");
    }

    // Handle URL shortening
    if (req.method === "POST" && urlPath === "/shorten") {
        const links = await loadLinks();

        let body = "";
        req.on("data", (chunk) => {
            body += chunk;
        });

        req.on("end", async () => {
            try {
                const { url, shortCode } = JSON.parse(body);

                if (!url) {
                    res.writeHead(400, { "Content-Type": "text/plain" });
                    return res.end("URL is required");
                }

                const finalShortCode = shortCode || crypto.randomBytes(4).toString("hex");

                if (links[finalShortCode]) {
                    res.writeHead(400, { "Content-Type": "text/plain" });
                    return res.end("Short Code already exists. Please choose another.");
                }

                links[finalShortCode] = url;
                await saveLinks(links);

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ shortCode: finalShortCode, url }));

            } catch (error) {
                res.writeHead(500, { "Content-Type": "text/plain" });
                res.end("Internal Server Error");
            }
        });
    }
});

// Start server
server.listen(PORT, () => {
    console.log(`Server is running at: http://localhost:${PORT}`);
});
