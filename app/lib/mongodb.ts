import { MongoClient, MongoClientOptions, Db, BSON } from 'mongodb';
import { ObjectId } from 'mongodb';

interface ShiftDocument {
  _id?: ObjectId;
  date: Date;
  type: 'AM' | 'PM' | 'FULL_DAY';
  status: 'active' | 'closed';
  createdAt: Date;
}

interface ShiftAssignmentDocument {
  _id?: ObjectId;
  shiftId: ObjectId;
  staffId: ObjectId;
  activeGroupId: ObjectId;
  createdAt: Date;
}

interface TipEntryDocument {
  _id?: ObjectId;
  shiftId: ObjectId;
  staffId: ObjectId;
  creditCardTips: number;
  cashTips?: number;
  recordedAt: Date;
}

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

const uri = process.env.MONGODB_URI;
const options: MongoClientOptions = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
    
    // Log connection in development
    globalWithMongo._mongoClientPromise
      .then(() => {
        console.log('🚀 MongoDB connected successfully in development mode');
      })
      .catch((error) => {
        console.error('❌ MongoDB connection failed:', error);
      });
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
  
  // Log connection in production
  clientPromise
    .then(() => {
      console.log('🚀 MongoDB connected successfully in production mode');
    })
    .catch((error) => {
      console.error('❌ MongoDB connection failed:', error);
    });
}

// Database connection utilities
export class DatabaseConnection {
  static async getClient(): Promise<MongoClient> {
    return clientPromise;
  }

  static async getDatabase(dbName: string = 'staff_management'): Promise<Db> {
    const client = await clientPromise;
    return client.db(dbName);
  }

  // Connection status and health check
  static async getConnectionStatus(): Promise<{
    connected: boolean;
    database: string;
    collections: string[];
    serverInfo?: any;
    error?: string;
  }> {
    try {
      const client = await clientPromise;
      const db = client.db('staff_management');
      
      // Test the connection
      await client.db('admin').command({ ping: 1 });
      
      const collections = await db.listCollections().toArray();
      const serverStatus = await client.db('admin').command({ serverStatus: 1 });
      
      console.log('✅ Database connection verified successfully');
      
      return {
        connected: true,
        database: db.databaseName,
        collections: collections.map(c => c.name),
        serverInfo: {
          version: serverStatus.version,
          uptime: serverStatus.uptime,
          host: serverStatus.host
        }
      };
    } catch (error) {
      console.error('❌ Database connection check failed:', error);
      return {
        connected: false,
        database: '',
        collections: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
