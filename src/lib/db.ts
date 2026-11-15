import mongoose from "mongoose";

interface MongooseConnectionCache {
  connection: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalWithMongooseCache = globalThis as typeof globalThis & {
  mongooseConnectionCache?: MongooseConnectionCache;
};

const connectionCache: MongooseConnectionCache =
  globalWithMongooseCache.mongooseConnectionCache ??
  (globalWithMongooseCache.mongooseConnectionCache = {
    connection: null,
    promise: null,
  });

function resolveMongoUri(): string {
  const uri = process.env.MONGODB_URI?.trim();

  if (!uri) {
    throw new Error(
      "Missing MONGODB_URI environment variable. Set MONGODB_URI to a MongoDB connection string before accessing the database.",
    );
  }

  return uri;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === mongoose.STATES.connected) {
    connectionCache.connection = mongoose;
    return mongoose;
  }

  if (connectionCache.promise) {
    return connectionCache.promise;
  }

  const uri = resolveMongoUri();

  connectionCache.promise = mongoose
    .connect(uri)
    .then((instance) => {
      connectionCache.connection = instance;
      return instance;
    })
    .catch((error: unknown) => {
      connectionCache.connection = null;
      connectionCache.promise = null;
      throw error;
    });

  return connectionCache.promise;
}