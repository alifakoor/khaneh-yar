// Executed by the mongo image on first initialization only.
const dbName = process.env.MONGODB_DB || "khanehyar";
db.getSiblingDB(dbName).createUser({
  user: process.env.MONGO_APP_USERNAME,
  pwd: process.env.MONGO_APP_PASSWORD,
  roles: [{ role: "readWrite", db: dbName }],
});
