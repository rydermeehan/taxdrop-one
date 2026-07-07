/* Client-side blob upload helper for the v2 review flow.
 *
 * app.jsx's `uploadEvidence()` calls `window.blobClientUpload(pathname, file,
 * { access, handleUploadUrl })` to push the customer's county-evidence files to
 * Vercel Blob before handing the submission to /api/intake. That global was
 * never defined on the page, so the guard `!window.blobClientUpload` always
 * fired and every intake shipped with `evidence: []` — which is why reviewed
 * submissions read "No county evidence uploaded" even when the homeowner had
 * uploaded their CAD packet.
 *
 * This is a dependency-free reimplementation of `upload` from
 * `@vercel/blob/client` (v2.x, blob API version 12). It performs the same two
 * steps the official client does — but without pulling a bundler or a runtime
 * CDN module into a page that is deliberately build-step-free:
 *
 *   1. POST the "blob.generate-client-token" event to the same-origin
 *      handleUploadUrl (/api/blob-upload). The server (which runs the official
 *      `handleUpload`) returns a short-lived client token.
 *   2. PUT the file straight to the Vercel Blob API, authenticated with that
 *      client token, and return the resulting public blob URL.
 *
 * Mirrors the wire format in @vercel/blob@2.6.0 (dist/client.js
 * `retrieveClientToken` + dist/chunk `createPutMethod`/`requestApi`). If Vercel
 * bumps the blob API version, update BLOB_API_VERSION / BLOB_API_URL here to
 * match the version the /api/blob-upload server was built against.
 */
(function () {
  "use strict";

  var BLOB_API_URL = "https://vercel.com/api/blob";
  var BLOB_API_VERSION = "12";

  // Client tokens are "vercel_blob_client_<storeId>_<random>"; the store id is
  // the 4th underscore-delimited segment (matches parseStoreIdFromReadWriteToken).
  function storeIdFromToken(token) {
    return String(token || "").split("_")[3] || "";
  }

  async function retrieveClientToken(handleUploadUrl, pathname) {
    var res = await fetch(handleUploadUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "blob.generate-client-token",
        payload: { pathname: pathname, clientPayload: null, multipart: false },
      }),
    });
    if (!res.ok) throw new Error("Failed to retrieve the blob client token");
    var data = await res.json();
    if (!data || !data.clientToken) throw new Error("Blob client token missing from response");
    return data.clientToken;
  }

  // upload(pathname, body, { access, handleUploadUrl, contentType }) → { url, ... }
  async function blobClientUpload(pathname, body, options) {
    options = options || {};
    if (!body) throw new Error("blobClientUpload: body is required");
    if (!options.handleUploadUrl) throw new Error("blobClientUpload: handleUploadUrl is required");
    var access = options.access || "public";

    var clientToken = await retrieveClientToken(options.handleUploadUrl, pathname);
    var storeId = storeIdFromToken(clientToken);

    var contentType =
      options.contentType || (body && body.type) || "application/octet-stream";

    var headers = {
      authorization: "Bearer " + clientToken,
      "x-api-version": BLOB_API_VERSION,
      "x-vercel-blob-store-id": storeId,
      "x-vercel-blob-access": access,
      "x-content-type": contentType,
    };

    var putUrl = BLOB_API_URL + "/?pathname=" + encodeURIComponent(pathname);
    var res = await fetch(putUrl, { method: "PUT", headers: headers, body: body });
    if (!res.ok) {
      var detail = "";
      try { detail = await res.text(); } catch (e) { /* ignore */ }
      throw new Error("Blob upload failed (" + res.status + ") " + detail);
    }
    return await res.json();
  }

  window.blobClientUpload = blobClientUpload;
})();
