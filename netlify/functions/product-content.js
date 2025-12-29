// netlify/functions/product-content.js
import https from "https";

const BASE_URL = "https://pinkblue.in/rest/V1";
const FIREWALL_HEADERS = {
  "Authorization": "Bearer t5xkjvxlgitd25cuhxixl9dflw008f4e",
  "Content-Type": "application/json"
};

function log(level, msg, meta) {
  console.log(JSON.stringify({ level, msg, ...(meta || {}) }));
}

async function getProduct(sku) {
  return new Promise((resolve) => {
    const url = `${BASE_URL}/products/${encodeURIComponent(sku)}`;
    log("INFO", `Getting product ${sku}`);

    const req = https.request(
      url,
      { method: "GET", headers: FIREWALL_HEADERS },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);

            const updatableAttrs = [
              "description",
              "short_description",
              "features",
              "technical_details",
              "package_content",
              "key_specification1",
              "key_specification2",
              "key_specification3",
              "key_specification4",
              "meta_title",
              "meta_description",
              "meta_keyword",
              "special_offers",
              "pdt_tags"
            ];

            const attributes = {};
            updatableAttrs.forEach((attr) => {
              const found =
                parsed.custom_attributes?.find(
                  (ca) => ca.attribute_code === attr
                ) || null;
              attributes[attr] = found ? found.value : "";
            });

            resolve({
              success: true,
              sku: parsed.sku,
              name: parsed.name,
              id: parsed.id,
              attributes,
              full_data: parsed
            });
          } catch (e) {
            log("ERROR", "Parse error in getProduct", { e: e.message });
            resolve({ success: false, error: "Parse error" });
          }
        });
      }
    );

    req.on("error", (e) => {
      log("ERROR", "Get Product Error", { error: e.message });
      resolve({ success: false, error: e.message });
    });

    req.setTimeout(8000, () => {
      req.abort();
      resolve({ success: false, error: "Timeout" });
    });

    req.end();
  });
}

async function updateProductAttributes(sku, updates) {
  return new Promise((resolve) => {
    const customAttributes = Array.isArray(updates) ? updates : [updates];

    const payload = JSON.stringify({
      product: {
        custom_attributes: customAttributes.map((u) => ({
          attribute_code: u.attribute_code,
          value: u.value
        }))
      }
    });

    const url = `${BASE_URL}/products/${encodeURIComponent(sku)}`;
    log("INFO", `Updating product ${sku}`, {
      count: customAttributes.length
    });

    const req = https.request(
      url,
      { method: "PUT", headers: FIREWALL_HEADERS },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            const ok = res.statusCode === 200;
            resolve({
              success: ok,
              statusCode: res.statusCode,
              sku,
              updated_attributes: customAttributes.map((u) => u.attribute_code),
              timestamp: new Date().toISOString(),
              data: parsed
            });
          } catch (e) {
            log("ERROR", "Parse error in updateProductAttributes", {
              e: e.message,
              raw: data.slice(0, 300)
            });
            resolve({
              success: false,
              error: "Parse error",
              raw: data.slice(0, 300)
            });
          }
        });
      }
    );

    req.on("error", (e) => {
      log("ERROR", "Product Update Error", { error: e.message });
      resolve({ success: false, error: e.message });
    });

    req.setTimeout(15000, () => {
      log("ERROR", "Product Update Timeout");
      req.abort();
      resolve({ success: false, error: "Request timeout" });
    });

    req.write(payload);
    req.end();
  });
}

export async function handler(event) {
  const type = event.queryStringParameters?.type;

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: ""
    };
  }

  if (type === "get_product") {
    const sku = event.queryStringParameters?.sku;
    if (!sku) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({ error: "SKU required" })
      };
    }
    const result = await getProduct(sku);
    return {
      statusCode: result.success ? 200 : 404,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify(result)
    };
  }

  if (type === "update_product") {
    const sku = event.queryStringParameters?.sku;
    if (!sku) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({ error: "SKU required" })
      };
    }

    let updates;
    try {
      updates = event.body ? JSON.parse(event.body) : [];
    } catch {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({ error: "Invalid JSON in request body" })
      };
    }
    if (!Array.isArray(updates) || updates.length === 0) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          error: "SKU and non-empty updates array required"
        })
      };
    }

    const result = await updateProductAttributes(sku, updates);
    return {
      statusCode: result.success ? 200 : 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify(result)
    };
  }

  return {
    statusCode: 400,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify({ error: "Invalid type" })
  };
}
