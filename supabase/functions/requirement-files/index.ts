import { S3Client, DeleteObjectCommand, GetObjectCommand } from "npm:@aws-sdk/client-s3@3.1156.0";
import { createPresignedPost } from "npm:@aws-sdk/s3-presigned-post@3.1156.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.1156.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const contentTypes: Record<string, string> = {
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pdf": "application/pdf",
};
const maxFileSize = 50 * 1024 * 1024;
const urlPrefix = "s3://";
const keyPrefix = "requerimientos";

class RequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requiredString(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new RequestError(400, `${label} inválido.`);
  }
  return value.trim();
}

function validateId(value: unknown, label: string) {
  const id = requiredString(value, `${label}: identificador`, 200);
  if (id.includes("/") || id.includes("\\") || id === "." || id === "..") {
    throw new RequestError(400, `${label}: identificador inválido.`);
  }
  return id;
}

// Files belong to a requirement or to an estimation; both live in the same company folder.
const owners = {
  requirement: { table: "requirements", label: "Requerimiento", notFound: "No se encontró el requerimiento." },
  estimation: { table: "estimations", label: "Estimación", notFound: "No se encontró la estimación." },
} as const;
type Owner = { kind: keyof typeof owners; id: string };

function readOwner(body: Record<string, unknown>): Owner {
  if (body.estimationId != null) return { kind: "estimation", id: validateId(body.estimationId, owners.estimation.label) };
  return { kind: "requirement", id: validateId(body.requirementId, owners.requirement.label) };
}

function validateFileName(value: unknown) {
  const fileName = requiredString(value, "Nombre del archivo", 255);
  const extension = fileName.match(/\.[^.]+$/)?.[0].toLowerCase() || "";
  const contentType = contentTypes[extension];
  if (!contentType) throw new RequestError(400, "Solo se permiten archivos Word o PDF.");
  const safeName = fileName.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(-180);
  if (!safeName) throw new RequestError(400, "Nombre del archivo inválido.");
  return { safeName, contentType };
}

function getS3Config() {
  const region = Deno.env.get("AWS_REGION");
  const bucket = Deno.env.get("AWS_S3_BUCKET");
  const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    throw new RequestError(500, "El almacenamiento S3 no está configurado.");
  }
  const sessionToken = Deno.env.get("AWS_SESSION_TOKEN");
  const s3 = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) },
  });
  return { s3, bucket };
}

async function getAuthorizedUser(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization) throw new RequestError(401, "Se requiere iniciar sesión.");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) throw new RequestError(500, "La función no está configurada.");
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new RequestError(401, "La sesión no es válida.");
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, role_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw new RequestError(403, "No se pudo verificar el perfil.");
  const role = String(profile?.role_id || profile?.role || "").trim().toLowerCase();
  if (role !== "dev" && role !== "pm") throw new RequestError(403, "No tienes permiso para gestionar documentos.");
  return supabase;
}

// Lowercase ASCII with "-" separators, e.g. "Coltanques S.A." -> "coltanques-s-a".
function slug(value: string, maxLength: number) {
  return value.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join("-")
    .slice(0, maxLength);
}

// Resolves where an owner's files live: requerimientos/<company-name>/ and its code
// (the requirement's main PBI or the estimation's number).
async function ownerLocation(supabase: ReturnType<typeof createClient>, owner: Owner) {
  const config = owners[owner.kind];
  const { data, error } = await supabase
    .from(config.table)
    .select("id, code, projects(companies(name))")
    .eq("id", owner.id)
    .maybeSingle();
  if (error || !data) throw new RequestError(404, config.notFound);
  const one = <T>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] : value);
  const company = one(one(data.projects as any)?.companies) as { name?: string } | undefined;
  const companyFolder = slug(typeof company?.name === "string" ? company.name : "", 80);
  if (!companyFolder) throw new RequestError(404, "No se encontró la empresa.");
  const code = slug(typeof data.code === "string" ? data.code : "", 40);
  if (!code) throw new RequestError(400, `${config.label} sin número. Asigna un número antes de adjuntar archivos.`);
  return { folder: `${keyPrefix}/${companyFolder}/`, code };
}

// Key layout: requerimientos/<company-name>/<code>_<id>_<file>
function validateKey(value: unknown) {
  const key = requiredString(value, "Clave del archivo", 1024);
  const parts = key.split("/");
  if (parts.length !== 3 || parts[0] !== keyPrefix || parts.some((part) => !part || part === "." || part === "..") || key.includes("\\")) {
    throw new RequestError(400, "Clave del archivo inválida.");
  }
  return key;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Método no permitido." }, 405);

  try {
    const body = await request.json();
    const action = requiredString(body?.action, "Acción", 40);
    const supabase = await getAuthorizedUser(request);
    const { s3, bucket } = getS3Config();

    if (action === "create-upload") {
      const { folder, code } = await ownerLocation(supabase, readOwner(body));
      const { safeName, contentType } = validateFileName(body.fileName);
      if (!Number.isSafeInteger(body.size) || body.size < 1 || body.size > maxFileSize) {
        throw new RequestError(400, "Cada archivo debe pesar entre 1 byte y 50 MB.");
      }
      if (body.contentType !== contentType) throw new RequestError(400, "El tipo de archivo no coincide con su extensión.");
      const key = `${folder}${code}_${crypto.randomUUID().slice(0, 8)}_${safeName}`;
      const signedPost = await createPresignedPost(s3, {
        Bucket: bucket,
        Key: key,
        Expires: 300,
        Conditions: [
          ["content-length-range", 1, maxFileSize],
          ["eq", "$Content-Type", contentType],
        ],
        Fields: { "Content-Type": contentType },
      });
      return jsonResponse({ uploadUrl: signedPost.url, fields: signedPost.fields, key });
    }

    if (action === "download" || action === "delete") {
      const key = validateKey(body.key);
      // RLS limits these lookups to documents the caller can see.
      const lookups = await Promise.all(["requirement_documents", "estimation_documents"].map((table) =>
        supabase.from(table).select("id").eq("url", urlPrefix + key).limit(1)
      ));
      if (lookups.some((result) => result.error)) throw new RequestError(500, "No se pudo verificar el documento.");
      const isLinked = lookups.some((result) => (result.data || []).length > 0);

      if (action === "download") {
        // The visible document row authorizes access, even if the company was renamed later.
        if (!isLinked) throw new RequestError(404, "No se encontró el documento.");
        const downloadUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
        return jsonResponse({ downloadUrl });
      }

      // Only unlinked objects (failed uploads or already-removed documents) in the
      // owner's company folder can be deleted.
      const { folder } = await ownerLocation(supabase, readOwner(body));
      if (!key.startsWith(folder)) throw new RequestError(400, "La clave del archivo no corresponde a la empresa.");
      if (isLinked) throw new RequestError(409, "El archivo sigue asociado a un documento; elimina primero el documento.");
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      return jsonResponse({ ok: true });
    }

    throw new RequestError(400, "Acción no válida.");
  } catch (error) {
    if (error instanceof RequestError) return jsonResponse({ error: error.message }, error.status);
    console.error("requirement-files failed:", error);
    return jsonResponse({ error: "No se pudo procesar el archivo." }, 500);
  }
});
