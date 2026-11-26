export const demoPasswords = {
  organizer: "gopsuc-organizer-demo",
  admin: "gopsuc-admin-demo",
};

export function previewEnv(base, database, origin) {
  return {
    ...base,
    NODE_ENV: "production",
    // Empty values override inherited settings and keep Next from loading
    // hosted configuration from .env files during the rehearsal.
    DATABASE_URL: "",
    VERCEL: "",
    DATABASE_FILE: database,
    SITE_URL: origin,
    ADMIN_PASSWORD: demoPasswords.admin,
    ORGANIZER_PASSWORD: demoPasswords.organizer,
  };
}
